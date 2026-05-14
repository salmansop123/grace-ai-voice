from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db, require_admin
from core.rate_limit import limiter
from core.redis import redis_client
from models.agent import Agent
from models.organization import Organization
from services.twilio_service import buy_number, list_available_numbers

router = APIRouter()


def _normalize_phone_number(value: str) -> str:
    raw = value.strip()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="phone_number is required",
        )

    digits = "".join(char for char in raw if char.isdigit())
    cleaned = f"+{digits}" if digits else ""
    if len(digits) < 8 or len(digits) > 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="phone_number must be E.164 format (e.g. +15551234567)",
        )
    return cleaned


@router.get("")
async def list_numbers(
    country_code: str = Query(default="US"),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    agents_result = await db.execute(select(Agent).where(Agent.org_id == org.id))
    agents = agents_result.scalars().all()

    assigned = [
        {"phone_number": agent.phone_number, "agent_id": agent.id, "agent_name": agent.name}
        for agent in agents
        if agent.phone_number
    ]
    for agent in agents:
        extra_key = f"org:{org.id}:agent:{agent.id}:assigned_numbers"
        extra_numbers = await redis_client.smembers(extra_key)
        for number in sorted(list(extra_numbers)):
            if any(item["phone_number"] == number for item in assigned):
                continue
            assigned.append({"phone_number": number, "agent_id": agent.id, "agent_name": agent.name})
    assigned_numbers = {item["phone_number"] for item in assigned}

    purchased_key = f"org:{org.id}:purchased_numbers"
    purchased_raw = await redis_client.smembers(purchased_key)
    purchased_numbers = sorted(list(purchased_raw))
    purchased_set = set(purchased_numbers)

    available_all = await list_available_numbers(country_code=country_code)
    available_all_set = set(available_all)
    custom_candidates_key = f"org:{org.id}:custom_number_candidates"
    custom_candidates_raw = await redis_client.smembers(custom_candidates_key)
    custom_candidates = sorted(list(custom_candidates_raw))

    available = [number for number in available_all if number not in purchased_set]
    for number in custom_candidates:
        if number not in purchased_set and number not in available:
            available.append(number)

    return {
        "assigned": assigned,
        "purchased_numbers": purchased_numbers,
        "available_numbers": available,
        "custom_candidates": custom_candidates,
        "custom_available_numbers": [n for n in custom_candidates if n not in available_all_set],
    }


@router.post("/buy")
@limiter.limit("10/minute")
async def buy_phone_number(
    request: Request,
    payload: dict = Body(...),
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
) -> dict:
    phone_number = _normalize_phone_number(str(payload.get("phone_number", "")))

    purchased = await buy_number(phone_number)
    purchased_key = f"org:{org.id}:purchased_numbers"
    await redis_client.sadd(purchased_key, purchased)
    return {"message": "Number purchased", "phone_number": purchased}


@router.post("/candidates")
@limiter.limit("20/minute")
async def add_custom_number_candidate(
    request: Request,
    payload: dict = Body(...),
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    number = _normalize_phone_number(str(payload.get("phone_number", "")))

    assigned_result = await db.execute(
        select(Agent).where(Agent.org_id == org.id, Agent.phone_number == number)
    )
    assigned_agent = assigned_result.scalar_one_or_none()
    if assigned_agent is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Number already exists and is assigned to agent '{assigned_agent.name}'",
        )

    purchased_key = f"org:{org.id}:purchased_numbers"
    purchased_raw = await redis_client.smembers(purchased_key)
    if number in set(purchased_raw):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Number already exists in purchased list")

    custom_candidates_key = f"org:{org.id}:custom_number_candidates"
    custom_candidates_raw = await redis_client.smembers(custom_candidates_key)
    if number in set(custom_candidates_raw):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Number already exists in custom list")

    await redis_client.sadd(custom_candidates_key, number)
    return {"message": "Custom number added", "phone_number": number}


@router.post("/candidates/remove")
@limiter.limit("20/minute")
async def remove_custom_number_candidate(
    request: Request,
    payload: dict = Body(...),
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
) -> dict:
    number = _normalize_phone_number(str(payload.get("phone_number", "")))
    custom_candidates_key = f"org:{org.id}:custom_number_candidates"
    removed_count = await redis_client.srem(custom_candidates_key, number)
    if removed_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Number not found in custom list")
    return {"message": "Custom number removed", "phone_number": number}


@router.post("/remove")
@limiter.limit("20/minute")
async def remove_phone_number(
    request: Request,
    payload: dict = Body(...),
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    number = _normalize_phone_number(str(payload.get("phone_number", "")))
    number_owner_key = f"org:{org.id}:assigned_number:{number}"
    owner_id = await redis_client.get(number_owner_key)
    if owner_id:
        assigned_result = await db.execute(
            select(Agent).where(Agent.org_id == org.id, Agent.id == owner_id)
        )
        assigned_agent = assigned_result.scalar_one_or_none()
        if assigned_agent is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Number is assigned to agent '{assigned_agent.name}'. Unassign it first.",
            )
        # Stale mapping for deleted agent: cleanup and continue.
        await redis_client.delete(number_owner_key)
        await redis_client.delete(f"assigned_number:{number}")

    purchased_key = f"org:{org.id}:purchased_numbers"
    removed_count = await redis_client.srem(purchased_key, number)
    if removed_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Number not found in purchased list")

    # Keep removed numbers visible in available list for re-purchase.
    custom_candidates_key = f"org:{org.id}:custom_number_candidates"
    await redis_client.sadd(custom_candidates_key, number)
    return {"message": "Number removed", "phone_number": number}


@router.post("/unassign")
@limiter.limit("30/minute")
async def unassign_phone_number(
    request: Request,
    payload: dict = Body(...),
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    number = _normalize_phone_number(str(payload.get("phone_number", "")))
    agent_id = str(payload.get("agent_id", "")).strip()
    if not agent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent_id is required")

    agent_result = await db.execute(
        select(Agent).where(Agent.org_id == org.id, Agent.id == agent_id)
    )
    agent = agent_result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    owner_id = await redis_client.get(f"assigned_number:{number}")
    if owner_id and owner_id != agent.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number is assigned to another agent",
        )

    agent_numbers_key = f"org:{org.id}:agent:{agent.id}:assigned_numbers"
    await redis_client.srem(agent_numbers_key, number)
    await redis_client.delete(f"org:{org.id}:assigned_number:{number}")
    await redis_client.delete(f"assigned_number:{number}")

    if agent.phone_number == number:
        remaining = sorted(list(await redis_client.smembers(agent_numbers_key)))
        agent.phone_number = remaining[0] if remaining else None
        await db.commit()

    return {"message": "Number unassigned", "phone_number": number, "agent_id": agent.id}
