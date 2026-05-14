from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from models.call import Call
from models.campaign import Campaign
from models.contact import Contact
from models.conversation_message import ConversationMessage
from models.organization import Organization

router = APIRouter()


@router.get("")
async def list_customers(
    q: str | None = Query(default=None),
    channel: str = Query(default="all"),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    channel_filter = channel.lower()
    base_query = select(Contact).where(Contact.org_id == org.id)
    if q:
        needle = f"%{q}%"
        base_query = base_query.where(
            or_(
                Contact.name.ilike(needle),
                Contact.phone.ilike(needle),
                Contact.email.ilike(needle),
            )
        )

    contacts = (await db.execute(base_query.order_by(desc(Contact.created_at)).limit(300))).scalars().all()
    if not contacts:
        return []

    payload: list[dict] = []
    for contact in contacts:
        call_count = (
            await db.execute(
                select(func.count(Call.id)).where(
                    and_(
                        Call.org_id == org.id,
                        or_(
                            Call.from_number == contact.phone,
                            Call.to_number == contact.phone,
                        ),
                    )
                )
            )
        ).scalar_one() or 0

        email_count = (
            await db.execute(
                select(func.count(ConversationMessage.id)).where(
                    and_(
                        ConversationMessage.org_id == org.id,
                        ConversationMessage.contact_id == contact.id,
                        ConversationMessage.channel == "email",
                    )
                )
            )
        ).scalar_one() or 0

        sms_count = (
            await db.execute(
                select(func.count(ConversationMessage.id)).where(
                    and_(
                        ConversationMessage.org_id == org.id,
                        ConversationMessage.contact_id == contact.id,
                        ConversationMessage.channel.in_(["text", "sms"]),
                    )
                )
            )
        ).scalar_one() or 0

        preferred_channel = "Call"
        max_count = call_count
        if email_count > max_count:
            preferred_channel = "Email"
            max_count = email_count
        if sms_count > max_count:
            preferred_channel = "SMS"
            max_count = sms_count

        if max_count == 0:
            preferred_channel = "Not contacted"

        if channel_filter == "call" and call_count == 0:
            continue
        if channel_filter == "email" and email_count == 0:
            continue
        if channel_filter == "sms" and sms_count == 0:
            continue

        payload.append(
            {
                "id": contact.id,
                "name": contact.name,
                "phone": contact.phone,
                "email": contact.email,
                "created_at": contact.created_at.isoformat(),
                "calls": int(call_count),
                "emails": int(email_count),
                "sms": int(sms_count),
                "preferred_channel": preferred_channel,
            }
        )

    return payload


@router.get("/{contact_id}")
async def get_customer(
    contact_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    contact = (
        await db.execute(
            select(Contact).where(Contact.id == contact_id, Contact.org_id == org.id)
        )
    ).scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return {
        "id": contact.id,
        "name": contact.name,
        "phone": contact.phone,
        "email": contact.email,
        "tags": contact.tags or [],
        "notes": contact.notes,
        "created_at": contact.created_at.isoformat(),
    }


@router.put("/{contact_id}")
async def update_customer(
    contact_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    contact = (
        await db.execute(
            select(Contact).where(Contact.id == contact_id, Contact.org_id == org.id)
        )
    ).scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    for field in ["name", "phone", "email", "notes", "tags"]:
        if field in payload:
            setattr(contact, field, payload[field])
    await db.commit()
    await db.refresh(contact)
    return {
        "id": contact.id,
        "name": contact.name,
        "phone": contact.phone,
        "email": contact.email,
        "tags": contact.tags or [],
        "notes": contact.notes,
        "created_at": contact.created_at.isoformat(),
    }


@router.get("/{contact_id}/timeline")
async def customer_timeline(
    contact_id: str,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    contact = (
        await db.execute(select(Contact).where(Contact.id == contact_id, Contact.org_id == org.id))
    ).scalar_one_or_none()
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    timeline: list[dict] = []

    calls = (
        await db.execute(
            select(Call)
            .where(
                Call.org_id == org.id,
                or_(Call.from_number == contact.phone, Call.to_number == contact.phone),
            )
            .order_by(desc(Call.created_at))
            .limit(100)
        )
    ).scalars().all()
    for call in calls:
        timeline.append(
            {
                "type": "call",
                "id": call.id,
                "direction": call.direction,
                "duration": call.duration,
                "outcome": call.outcome,
                "sentiment": call.sentiment,
                "summary": call.summary,
                "transcript": call.transcript or [],
                "created_at": call.created_at.isoformat(),
            }
        )

    messages = (
        await db.execute(
            select(ConversationMessage)
            .where(ConversationMessage.org_id == org.id, ConversationMessage.contact_id == contact.id)
            .order_by(desc(ConversationMessage.created_at))
            .limit(100)
        )
    ).scalars().all()
    for message in messages:
        if message.channel in {"email", "text", "sms"}:
            timeline.append(
                {
                    "type": "inbox",
                    "id": message.id,
                    "channel": message.channel,
                    "subject": (message.meta or {}).get("subject") if isinstance(message.meta, dict) else None,
                    "preview": message.body[:160],
                    "status": "read" if message.is_read else "unread",
                    "body": message.body,
                    "created_at": message.created_at.isoformat(),
                }
            )
            if message.channel in {"text", "sms"}:
                timeline.append(
                    {
                        "type": "sms",
                        "id": message.id,
                        "message": message.body,
                        "direction": "inbound" if message.sender_role == "customer" else "outbound",
                        "created_at": message.created_at.isoformat(),
                    }
                )

    campaigns = (
        await db.execute(
            select(Campaign)
            .where(Campaign.org_id == org.id)
            .where(Campaign.contact_ids.overlap(array([contact.id])))
            .order_by(desc(Campaign.created_at))
            .limit(100)
        )
    ).scalars().all()
    for campaign in campaigns:
        timeline.append(
            {
                "type": "job",
                "id": campaign.id,
                "campaign_name": campaign.name,
                "status": campaign.status,
                "created_at": campaign.created_at.isoformat(),
            }
        )

    timeline.sort(key=lambda item: item["created_at"], reverse=True)
    return timeline[offset : offset + limit]
