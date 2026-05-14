import json
import time
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select
from twilio.request_validator import RequestValidator

from core.config import settings
from core.database import AsyncSessionLocal
from core.rate_limit import limiter
from core.redis import redis_client
from core.plan_limits import ensure_minutes_available
from models.agent import Agent
from models.call import Call
from models.organization import Organization
from workers.post_call_worker import process_call_end

router = APIRouter()


def _build_request_url(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_proto and forwarded_host:
        url = f"{forwarded_proto}://{forwarded_host}{request.url.path}"
        if request.url.query:
            url = f"{url}?{request.url.query}"
        return url
    return str(request.url)


def _validate_signature(request: Request, params: dict[str, str]) -> None:
    signature = request.headers.get("X-Twilio-Signature", "")
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    if not validator.validate(_build_request_url(request), params, signature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Twilio signature",
        )
    timestamp_header = request.headers.get("X-Twilio-Signature-Timestamp")
    if timestamp_header:
        try:
            timestamp = int(timestamp_header)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio timestamp") from exc
        if abs(time.time() - timestamp) > 300:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Twilio request expired")


@router.post("/inbound")
@limiter.limit("100/minute")
async def inbound_webhook(request: Request) -> Response:
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}
    _validate_signature(request, params)

    to_number = params.get("To")
    from_number = params.get("From")
    twilio_call_sid = params.get("CallSid")
    if not to_number or not from_number or not twilio_call_sid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required Twilio params",
        )

    async with AsyncSessionLocal() as db:
        agent_result = await db.execute(
            select(Agent).where(Agent.phone_number == to_number)
        )
        agent = agent_result.scalar_one_or_none()
        if agent is None:
            owner_id = await redis_client.get(f"assigned_number:{to_number}")
            if owner_id:
                owner_result = await db.execute(select(Agent).where(Agent.id == owner_id))
                agent = owner_result.scalar_one_or_none()
        if agent is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="No agent assigned"
            )
        org_result = await db.execute(select(Organization).where(Organization.id == agent.org_id))
        org = org_result.scalar_one_or_none()
        if org is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        ensure_minutes_available(org)

        call = Call(
            org_id=agent.org_id,
            agent_id=agent.id,
            twilio_call_sid=twilio_call_sid,
            direction="INBOUND",
            from_number=from_number,
            to_number=to_number,
            status="initiated",
            created_at=datetime.utcnow(),
        )
        db.add(call)
        await db.commit()
        await db.refresh(call)

        await redis_client.publish(
            f"live_calls:{agent.org_id}",
            json.dumps(
                {
                    "event": "call_started",
                    "call_sid": twilio_call_sid,
                    "org_id": agent.org_id,
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "from_number": from_number,
                    "to_number": to_number,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ),
        )

        ws_url = settings.BACKEND_URL.replace("http://", "ws://").replace(
            "https://", "wss://"
        )
        stream_url = f"{ws_url}/ws/stream/{twilio_call_sid}"

        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="{stream_url}">
      <Parameter name="agent_id" value="{agent.id}" />
      <Parameter name="org_id" value="{agent.org_id}" />
      <Parameter name="call_db_id" value="{call.id}" />
      <Parameter name="direction" value="INBOUND" />
    </Stream>
  </Connect>
</Response>"""
        return Response(content=twiml, media_type="text/xml")


@router.post("/status")
async def status_webhook(request: Request) -> Response:
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}
    _validate_signature(request, params)

    call_sid = params.get("CallSid")
    call_status = params.get("CallStatus")
    call_duration = params.get("CallDuration")
    if not call_sid:
        return Response(status_code=200)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Call).where(Call.twilio_call_sid == call_sid))
        call = result.scalar_one_or_none()
        if call is not None:
            if call_status:
                call.status = call_status
            if call_duration and call_duration.isdigit():
                call.duration = int(call_duration)
            await db.commit()
            process_call_end.delay(call_sid, call.org_id, call.id)

    return Response(status_code=200)


@router.post("/outbound-twiml")
async def outbound_twiml(request: Request) -> Response:
    agent_id = request.query_params.get("agent_id")
    org_id = request.query_params.get("org_id")
    if not agent_id or not org_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent_id and org_id are required")

    form = await request.form()
    call_sid = str(form.get("CallSid", ""))
    if not call_sid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CallSid is required")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == org_id))
        agent = result.scalar_one_or_none()
        if agent is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        call_result = await db.execute(
            select(Call).where(
                Call.twilio_call_sid == call_sid,
                Call.org_id == org_id,
                Call.agent_id == agent_id,
            )
        )
        call = call_result.scalar_one_or_none()
        if call is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
        call_db_id = call.id

    ws_url = settings.BACKEND_URL.replace("http://", "ws://").replace(
        "https://", "wss://"
    )
    stream_url = f"{ws_url}/ws/stream/{call_sid}"
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="{stream_url}">
      <Parameter name="agent_id" value="{agent_id}" />
      <Parameter name="org_id" value="{org_id}" />
      <Parameter name="call_db_id" value="{call_db_id}" />
      <Parameter name="direction" value="OUTBOUND" />
    </Stream>
  </Connect>
</Response>"""
    return Response(content=twiml, media_type="text/xml")
