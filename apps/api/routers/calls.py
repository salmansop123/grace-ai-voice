from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.deps import get_current_org, get_db
from core.plan_limits import ensure_minutes_available
from core.rate_limit import limiter
from core.redis import redis_client
from models.agent import Agent
from models.call import Call
from models.organization import Organization
from services.twilio_service import place_call

router = APIRouter()


@router.get("")
async def list_calls(
    direction: str | None = Query(default=None),
    outcome: str | None = Query(default=None),
    status: str | None = Query(default=None),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    query = (
        select(Call, Agent.name)
        .join(Agent, Agent.id == Call.agent_id)
        .where(Call.org_id == org.id)
    )
    if direction:
        query = query.where(Call.direction == direction)
    if outcome:
        query = query.where(Call.outcome == outcome)
    if status:
        query = query.where(Call.status == status)

    result = await db.execute(query.order_by(desc(Call.created_at)).limit(100))
    rows = result.all()
    return [
        {
            "id": call.id,
            "twilio_call_sid": call.twilio_call_sid,
            "agent_id": call.agent_id,
            "agent_name": agent_name,
            "from_number": call.from_number,
            "to_number": call.to_number,
            "direction": call.direction,
            "status": call.status,
            "duration": call.duration,
            "outcome": call.outcome,
            "connected": bool((call.duration or 0) > 0 or (call.status or "").lower() in {"in-progress", "completed"}),
            "had_conversation": bool(isinstance(call.transcript, list) and len(call.transcript) > 0),
            "created_at": call.created_at.isoformat(),
        }
        for call, agent_name in rows
    ]


@router.get("/{call_id}")
async def get_call(
    call_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Call, Agent.name)
        .join(Agent, Agent.id == Call.agent_id)
        .where(Call.id == call_id, Call.org_id == org.id)
    )
    row = result.one_or_none()
    if row is None:
        return {"message": "Call not found"}

    call, agent_name = row
    return {
        "id": call.id,
        "twilio_call_sid": call.twilio_call_sid,
        "agent_id": call.agent_id,
        "agent_name": agent_name,
        "from_number": call.from_number,
        "to_number": call.to_number,
        "direction": call.direction,
        "status": call.status,
        "duration": call.duration,
        "outcome": call.outcome,
        "sentiment": call.sentiment,
        "summary": call.summary,
        "recording_url": call.recording_url,
        "transcript": call.transcript or [],
        "created_at": call.created_at.isoformat(),
    }


@router.post("/outbound")
@limiter.limit("10/minute")
async def create_outbound_call(
    request: Request,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ensure_minutes_available(org)
    to_number = str(payload.get("to", "")).strip()
    agent_id = str(payload.get("agent_id", "")).strip()
    if not to_number or not agent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="to and agent_id are required")

    agent = (
        await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id))
    ).scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    from_number = (agent.phone_number or "").strip()
    if not from_number:
        assigned_key = f"org:{org.id}:agent:{agent.id}:assigned_numbers"
        assigned_numbers = sorted(list(await redis_client.smembers(assigned_key)))
        from_number = assigned_numbers[0] if assigned_numbers else ""
    if not from_number:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent has no assigned phone number")

    twiml_url = f"{settings.BACKEND_URL}/webhooks/twilio/outbound-twiml?agent_id={agent.id}&org_id={org.id}"
    call_sid = await place_call(from_number, to_number, twiml_url)
    if not call_sid:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not initiate outbound call")

    call = Call(
        org_id=org.id,
        agent_id=agent.id,
        twilio_call_sid=call_sid,
        direction="OUTBOUND",
        from_number=from_number,
        to_number=to_number,
        status="initiated",
        created_at=datetime.utcnow(),
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)
    return {"id": call.id, "twilio_call_sid": call_sid, "status": call.status}
