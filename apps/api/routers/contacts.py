from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from models.campaign import Campaign
from models.contact import Contact
from models.conversation_message import ConversationMessage
from models.conversation_thread import ConversationThread
from models.organization import Organization
from schemas.contact import ContactCreate

router = APIRouter()


@router.get("")
async def list_contacts(
    org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    result = await db.execute(
        select(Contact).where(Contact.org_id == org.id).order_by(desc(Contact.created_at)).limit(200)
    )
    contacts = result.scalars().all()
    return [
        {
            "id": contact.id,
            "name": contact.name,
            "phone": contact.phone,
            "email": contact.email,
            "tags": contact.tags or [],
            "notes": contact.notes,
            "created_at": contact.created_at.isoformat(),
        }
        for contact in contacts
    ]


@router.post("")
async def create_contact(
    payload: ContactCreate,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    async def ensure_thread_for_contact(contact: Contact) -> None:
        thread_result = await db.execute(
            select(ConversationThread).where(
                ConversationThread.org_id == org.id,
                ConversationThread.contact_id == contact.id,
            )
        )
        thread = thread_result.scalar_one_or_none()
        if thread is None:
            db.add(
                ConversationThread(
                    org_id=org.id,
                    contact_id=contact.id,
                    subject=contact.name,
                    unread_count=0,
                )
            )
            await db.commit()

    existing = await db.execute(
        select(Contact).where(Contact.org_id == org.id, Contact.phone == payload.phone)
    )
    existing_contact = existing.scalar_one_or_none()
    if existing_contact is not None:
        # Idempotent create: treat same phone as an update to avoid UX failures.
        existing_contact.name = payload.name or existing_contact.name
        existing_contact.email = payload.email if payload.email is not None else existing_contact.email
        existing_contact.notes = payload.notes if payload.notes is not None else existing_contact.notes
        if payload.tags:
            existing_contact.tags = payload.tags
        await db.commit()
        await db.refresh(existing_contact)
        await ensure_thread_for_contact(existing_contact)
        return {
            "id": existing_contact.id,
            "name": existing_contact.name,
            "phone": existing_contact.phone,
            "email": existing_contact.email,
            "tags": existing_contact.tags or [],
            "notes": existing_contact.notes,
            "created_at": existing_contact.created_at.isoformat(),
        }

    contact = Contact(
        org_id=org.id,
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        tags=payload.tags,
        notes=payload.notes,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    await ensure_thread_for_contact(contact)
    return {
        "id": contact.id,
        "name": contact.name,
        "phone": contact.phone,
        "email": contact.email,
        "tags": contact.tags or [],
        "notes": contact.notes,
        "created_at": contact.created_at.isoformat(),
    }


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    contact = (
        await db.execute(select(Contact).where(Contact.id == contact_id, Contact.org_id == org.id))
    ).scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    # Remove inbox data tied to this contact so deleted users do not reappear in searches.
    thread_ids = (
        await db.execute(
            select(ConversationThread.id).where(
                ConversationThread.org_id == org.id,
                ConversationThread.contact_id == contact_id,
            )
        )
    ).scalars().all()
    if thread_ids:
        await db.execute(
            ConversationMessage.__table__.delete().where(
                ConversationMessage.org_id == org.id,
                ConversationMessage.thread_id.in_(thread_ids),
            )
        )
        await db.execute(
            ConversationThread.__table__.delete().where(
                ConversationThread.org_id == org.id,
                ConversationThread.id.in_(thread_ids),
            )
        )

    await db.execute(
        ConversationMessage.__table__.delete().where(
            ConversationMessage.org_id == org.id,
            ConversationMessage.contact_id == contact_id,
        )
    )

    # Remove deleted contact from any campaigns that still reference it.
    campaigns = (
        await db.execute(select(Campaign).where(Campaign.org_id == org.id))
    ).scalars().all()
    for campaign in campaigns:
        if not campaign.contact_ids:
            continue
        next_contact_ids = [item for item in campaign.contact_ids if item != contact_id]
        if len(next_contact_ids) != len(campaign.contact_ids):
            campaign.contact_ids = next_contact_ids
    await db.flush()

    await db.delete(contact)
    await db.commit()
    return {"message": "Contact deleted", "id": contact_id}
