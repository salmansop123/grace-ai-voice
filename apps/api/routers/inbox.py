import json
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from core.redis import redis_client
from models.call import Call
from models.contact import Contact
from models.conversation_message import ConversationMessage
from models.conversation_thread import ConversationThread
from models.organization import Organization
from services.appointment_booking import (
    create_auto_appointment_from_message,
    update_appointment_status_from_confirmation,
)

router = APIRouter()


def _normalize_channel(value: str) -> str:
    mapping = {"call": "call", "email": "email", "text": "text", "all": "all"}
    return mapping.get(value.lower(), "all")


async def _ensure_thread_from_call_fallback(org_id: str, db: AsyncSession) -> None:
    existing_result = await db.execute(
        select(func.count(ConversationThread.id)).where(ConversationThread.org_id == org_id)
    )
    existing_count = existing_result.scalar_one() or 0
    if existing_count > 0:
        return

    calls_result = await db.execute(
        select(Call).where(Call.org_id == org_id).order_by(desc(Call.created_at)).limit(20)
    )
    calls = calls_result.scalars().all()
    for call in calls:
        thread = ConversationThread(
            org_id=org_id,
            contact_id=None,
            subject=f"Call from {call.from_number}",
            unread_count=0,
            last_message_at=call.created_at,
        )
        db.add(thread)
        await db.flush()

        transcript_items = call.transcript or []
        if transcript_items:
            for item in transcript_items:
                role = str(item.get("role", "customer"))
                body = str(item.get("content", "")).strip()
                if not body:
                    continue
                sender_role = "agent_ai" if role == "assistant" else "customer"
                msg = ConversationMessage(
                    thread_id=thread.id,
                    org_id=org_id,
                    contact_id=None,
                    channel="call",
                    sender_role=sender_role,
                    body=body,
                    meta={"call_id": call.id, "twilio_call_sid": call.twilio_call_sid},
                    is_read=True,
                    created_at=call.created_at,
                )
                db.add(msg)
        else:
            db.add(
                ConversationMessage(
                    thread_id=thread.id,
                    org_id=org_id,
                    contact_id=None,
                    channel="call",
                    sender_role="system",
                    body=f"Call status: {call.status}",
                    meta={"call_id": call.id, "twilio_call_sid": call.twilio_call_sid},
                    is_read=True,
                    created_at=call.created_at,
                )
            )

    await db.commit()


async def _ensure_threads_for_contacts(org_id: str, db: AsyncSession) -> None:
    contacts = (
        await db.execute(
            select(Contact).where(Contact.org_id == org_id).order_by(desc(Contact.created_at)).limit(1000)
        )
    ).scalars().all()
    if not contacts:
        return

    existing_thread_contact_ids = set(
        (
            await db.execute(
                select(ConversationThread.contact_id).where(
                    ConversationThread.org_id == org_id,
                    ConversationThread.contact_id.is_not(None),
                )
            )
        ).scalars().all()
    )

    created_any = False
    for contact in contacts:
        if contact.id in existing_thread_contact_ids:
            continue
        db.add(
            ConversationThread(
                org_id=org_id,
                contact_id=contact.id,
                subject=contact.name,
                unread_count=0,
                last_message_at=None,
            )
        )
        created_any = True

    if created_any:
        await db.commit()


@router.get("/threads")
async def list_threads(
    q: str | None = Query(default=None),
    channel: str = Query(default="all"),
    status_filter: str = Query(default="all", alias="status"),
    sort: str = Query(default="newest"),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    await _ensure_thread_from_call_fallback(org.id, db)
    await _ensure_threads_for_contacts(org.id, db)
    normalized_channel = _normalize_channel(channel)
    normalized_status = status_filter.lower()
    normalized_sort = sort.lower()

    latest_message_subquery = (
        select(
            ConversationMessage.thread_id.label("thread_id"),
            func.max(ConversationMessage.created_at).label("latest_message_at"),
        )
        .where(ConversationMessage.org_id == org.id)
        .group_by(ConversationMessage.thread_id)
        .subquery()
    )

    base = (
        select(
            ConversationThread,
            Contact.name,
            Contact.email,
            Contact.phone,
            ConversationMessage.body.label("last_body"),
            ConversationMessage.channel.label("last_channel"),
        )
        .join(Contact, Contact.id == ConversationThread.contact_id, isouter=True)
        .join(
            latest_message_subquery,
            latest_message_subquery.c.thread_id == ConversationThread.id,
            isouter=True,
        )
        .join(
            ConversationMessage,
            and_(
                ConversationMessage.thread_id == ConversationThread.id,
                ConversationMessage.created_at == latest_message_subquery.c.latest_message_at,
            ),
            isouter=True,
        )
        .where(ConversationThread.org_id == org.id)
    )

    if q:
        needle = f"%{q}%"
        base = base.where(
            or_(
                Contact.name.ilike(needle),
                Contact.email.ilike(needle),
                Contact.phone.ilike(needle),
                ConversationThread.subject.ilike(needle),
            )
        )

    if normalized_channel != "all":
        channel_match = (
            select(func.count(ConversationMessage.id))
            .where(
                ConversationMessage.thread_id == ConversationThread.id,
                ConversationMessage.org_id == org.id,
                ConversationMessage.channel == normalized_channel,
            )
            .correlate(ConversationThread)
            .scalar_subquery()
        )
        base = base.where(channel_match > 0)

    if normalized_status == "read":
        base = base.where(ConversationThread.unread_count == 0)
    elif normalized_status == "unread":
        base = base.where(ConversationThread.unread_count > 0)

    if normalized_sort == "oldest":
        base = base.order_by(asc(ConversationThread.last_message_at), asc(ConversationThread.created_at))
    else:
        base = base.order_by(desc(ConversationThread.last_message_at), desc(ConversationThread.created_at))

    rows = (await db.execute(base.limit(200))).all()
    if not rows:
        return []

    thread_ids = [row[0].id for row in rows]
    channel_counts_query = await db.execute(
        select(
            ConversationMessage.thread_id,
            ConversationMessage.channel,
            func.count(ConversationMessage.id),
        )
        .where(
            ConversationMessage.org_id == org.id,
            ConversationMessage.thread_id.in_(thread_ids),
        )
        .group_by(ConversationMessage.thread_id, ConversationMessage.channel)
    )
    counts_map: dict[str, dict[str, int]] = {}
    for thread_id, channel_name, count in channel_counts_query.all():
        counts_map.setdefault(thread_id, {})[channel_name] = int(count)

    payload: list[dict] = []
    for thread, contact_name, contact_email, contact_phone, last_body, last_channel in rows:
        counts = counts_map.get(thread.id, {})
        payload.append(
            {
                "id": thread.id,
                "contact_id": thread.contact_id,
                "customer_name": contact_name or "Unknown customer",
                "customer_email": contact_email,
                "customer_phone": contact_phone,
                "subject": thread.subject,
                "unread_count": int(thread.unread_count or 0),
                "last_message_preview": (last_body or "")[:180],
                "last_message_at": (
                    thread.last_message_at.isoformat()
                    if thread.last_message_at
                    else thread.created_at.isoformat()
                ),
                "last_channel": last_channel or "call",
                "counts": {
                    "call": counts.get("call", 0),
                    "email": counts.get("email", 0),
                    "text": counts.get("text", 0),
                },
            }
        )
    return payload


@router.get("/recent")
async def recent_messages(
    limit: int = Query(default=5, ge=1, le=50),
    since: str | None = Query(default=None),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    query = (
        select(ConversationMessage)
        .where(ConversationMessage.org_id == org.id)
        .order_by(desc(ConversationMessage.created_at))
        .limit(limit)
    )
    if since:
        query = query.where(ConversationMessage.id != since)
    rows = (await db.execute(query)).scalars().all()
    return [
        {
            "id": row.id,
            "channel": row.channel,
            "preview": row.body[:120],
            "timestamp": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/threads/{thread_id}")
async def get_thread(
    thread_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    thread_result = await db.execute(
        select(ConversationThread, Contact.name, Contact.email, Contact.phone)
        .join(Contact, Contact.id == ConversationThread.contact_id, isouter=True)
        .where(ConversationThread.id == thread_id, ConversationThread.org_id == org.id)
    )
    row = thread_result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    thread, customer_name, customer_email, customer_phone = row
    messages_result = await db.execute(
        select(ConversationMessage)
        .where(
            ConversationMessage.thread_id == thread_id,
            ConversationMessage.org_id == org.id,
        )
        .order_by(asc(ConversationMessage.created_at))
    )
    messages = messages_result.scalars().all()

    return {
        "id": thread.id,
        "contact_id": thread.contact_id,
        "customer_name": customer_name or "Unknown customer",
        "customer_email": customer_email,
        "customer_phone": customer_phone,
        "subject": thread.subject,
        "unread_count": int(thread.unread_count or 0),
        "messages": [
            {
                "id": message.id,
                "channel": message.channel,
                "sender_role": message.sender_role,
                "body": message.body,
                "meta": message.meta or {},
                "is_read": bool(message.is_read),
                "created_at": message.created_at.isoformat(),
            }
            for message in messages
        ],
    }


@router.post("/threads/{thread_id}/read")
async def mark_thread_read(
    thread_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    thread_result = await db.execute(
        select(ConversationThread).where(
            ConversationThread.id == thread_id,
            ConversationThread.org_id == org.id,
        )
    )
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    thread.unread_count = 0
    await db.execute(
        ConversationMessage.__table__.update()
        .where(
            ConversationMessage.thread_id == thread_id,
            ConversationMessage.org_id == org.id,
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "Thread marked as read", "id": thread_id, "timestamp": datetime.utcnow().isoformat()}


@router.post("/threads/{thread_id}/messages")
async def send_thread_message(
    thread_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    thread_result = await db.execute(
        select(ConversationThread).where(
            ConversationThread.id == thread_id,
            ConversationThread.org_id == org.id,
        )
    )
    thread = thread_result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    body = str(payload.get("body", "")).strip()
    channel = str(payload.get("channel", "email")).lower()
    sender_role = str(payload.get("sender_role", "agent_ai")).lower()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="body is required")
    if channel not in {"call", "email", "text"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid channel")
    if sender_role not in {"customer", "agent_ai", "agent_human", "system"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sender_role")

    message = ConversationMessage(
        thread_id=thread_id,
        org_id=org.id,
        contact_id=thread.contact_id,
        channel=channel,
        sender_role=sender_role,
        body=body,
        meta=payload.get("meta") if isinstance(payload.get("meta"), dict) else {},
        is_read=True,
    )
    db.add(message)
    thread.last_message_at = datetime.utcnow()
    if sender_role == "customer":
        thread.unread_count = (thread.unread_count or 0) + 1
    await db.commit()
    await db.refresh(message)
    auto_appointment_id: str | None = None
    auto_status_update: dict | None = None

    if sender_role == "customer":
        contact_name = thread.subject or "Customer"
        contact_phone = None
        if thread.contact_id:
            contact_result = await db.execute(select(Contact).where(Contact.id == thread.contact_id))
            contact = contact_result.scalar_one_or_none()
            if contact is not None:
                contact_name = contact.name or contact_name
                contact_phone = contact.phone
        try:
            auto_appointment = await create_auto_appointment_from_message(
                db=db,
                org_id=org.id,
                customer_name=contact_name,
                customer_phone=contact_phone,
                channel=channel,
                body=body,
                meta=message.meta or {},
            )
            if auto_appointment is not None:
                auto_appointment_id = auto_appointment.id
            status_update = await update_appointment_status_from_confirmation(
                db=db,
                org_id=org.id,
                customer_name=contact_name,
                customer_phone=contact_phone,
                body=body,
            )
            if status_update is not None:
                auto_status_update = {"job_id": status_update.id, "status": status_update.status}
        except Exception:
            auto_appointment_id = None
            auto_status_update = None

    if channel in {"email", "text"}:
        await redis_client.publish(
            f"live_inbox:{org.id}",
            json.dumps(
                {
                    "event": "new_message",
                    "channel": "sms" if channel == "text" else "email",
                    "from": thread.subject or "unknown",
                    "subject_or_preview": body[:120],
                    "timestamp": message.created_at.isoformat(),
                }
            ),
        )
        if channel == "text":
            await redis_client.publish(
                f"live_sms:{org.id}",
                json.dumps(
                    {
                        "event": "sms_update",
                        "channel": "sms",
                        "to": thread.subject or "unknown",
                        "message_preview": body[:120],
                        "status": "sent",
                        "timestamp": message.created_at.isoformat(),
                    }
                ),
            )
    return {
        "id": message.id,
        "thread_id": thread_id,
        "channel": message.channel,
        "sender_role": message.sender_role,
        "body": message.body,
        "created_at": message.created_at.isoformat(),
        "appointment_id": auto_appointment_id,
        "status_update": auto_status_update,
    }
