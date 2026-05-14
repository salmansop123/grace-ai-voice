import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from core.redis import redis_client
from models.call import Call
from models.conversation_message import ConversationMessage
from models.organization import Organization

router = APIRouter()


@router.get("/api/live/stream")
async def live_sse_endpoint(
    request: Request, org: Organization = Depends(get_current_org)
) -> StreamingResponse:
    async def _generator():
        pubsub = redis_client.pubsub()
        channels = [f"live_calls:{org.id}", f"live_inbox:{org.id}", f"live_sms:{org.id}"]
        await pubsub.subscribe(*channels)
        try:
            active_keys = await redis_client.keys(f"call:{org.id}:*:messages")
            active_call_sids = [key.split(":")[2] for key in active_keys]
            yield f"data: {json.dumps({'event': 'snapshot', 'active_calls': active_call_sids})}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=10.0)
                if message and message.get("type") == "message":
                    payload = message.get("data", "")
                    if isinstance(payload, bytes):
                        payload = payload.decode()
                    yield f"data: {payload}\n\n"
                else:
                    yield f"data: {json.dumps({'event': 'heartbeat'})}\n\n"
        finally:
            await pubsub.unsubscribe(*channels)
            await pubsub.close()

    return StreamingResponse(
        _generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/api/live/overview")
async def live_overview(
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    calls_stats_query = await db.execute(
        select(
            func.count(Call.id),
            func.count(
                func.distinct(
                    case(
                        (Call.direction == "OUTBOUND", Call.to_number),
                        else_=Call.from_number,
                    )
                )
            ),
        ).where(Call.org_id == org.id)
    )
    calls_total, call_customers = calls_stats_query.one()

    email_stats_query = await db.execute(
        select(
            func.count(ConversationMessage.id),
            func.count(func.distinct(ConversationMessage.contact_id)),
        ).where(
            ConversationMessage.org_id == org.id,
            ConversationMessage.channel == "email",
        )
    )
    email_messages, email_customers = email_stats_query.one()

    sms_stats_query = await db.execute(
        select(
            func.count(ConversationMessage.id),
            func.count(func.distinct(ConversationMessage.contact_id)),
        ).where(
            ConversationMessage.org_id == org.id,
            ConversationMessage.channel.in_(["text", "sms"]),
        )
    )
    sms_messages, sms_customers = sms_stats_query.one()

    return {
        "channels": {
            "calls": {
                "communications": int(calls_total or 0),
                "customers": int(call_customers or 0),
            },
            "email": {
                "communications": int(email_messages or 0),
                "customers": int(email_customers or 0),
            },
            "sms": {
                "communications": int(sms_messages or 0),
                "customers": int(sms_customers or 0),
            },
        }
    }
