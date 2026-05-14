from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from models.agent import Agent
from models.call import Call
from models.conversation_message import ConversationMessage
from models.organization import Organization

router = APIRouter()


@router.get("/overview")
async def jobs_overview(
    channel: str = Query(default="all"),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    normalized_channel = channel.lower()

    agents_result = await db.execute(
        select(Agent.id, Agent.name).where(Agent.org_id == org.id).order_by(Agent.name.asc())
    )
    agent_rows = agents_result.all()
    agent_map = {
        agent_id: {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "calls": 0,
            "connected_calls": 0,
            "conversations": 0,
            "emails": 0,
            "sms": 0,
        }
        for agent_id, agent_name in agent_rows
    }

    call_rows = (
        await db.execute(
            select(Call.agent_id, Call.status, Call.duration, Call.transcript).where(Call.org_id == org.id)
        )
    ).all()

    for agent_id, call_status, duration, transcript in call_rows:
        if agent_id not in agent_map:
            continue
        agent_map[agent_id]["calls"] += 1
        is_connected = bool((duration or 0) > 0 or (call_status or "").lower() in {"in-progress", "completed"})
        if is_connected:
            agent_map[agent_id]["connected_calls"] += 1
        if isinstance(transcript, list) and len(transcript) > 0:
            agent_map[agent_id]["conversations"] += 1

    message_rows = (
        await db.execute(
            select(ConversationMessage.meta, ConversationMessage.channel)
            .where(ConversationMessage.org_id == org.id)
            .where(ConversationMessage.sender_role.in_(["agent_ai", "agent_human"]))
        )
    ).all()
    for meta, msg_channel in message_rows:
        channel_name = str(msg_channel or "").lower()
        if channel_name not in {"email", "text", "sms"}:
            continue
        meta_dict = meta if isinstance(meta, dict) else {}
        agent_id = str(meta_dict.get("agent_id", "")).strip()
        if not agent_id or agent_id not in agent_map:
            continue
        if channel_name == "email":
            agent_map[agent_id]["emails"] += 1
        else:
            agent_map[agent_id]["sms"] += 1

    rows = list(agent_map.values())
    rows.sort(key=lambda item: item["agent_name"].lower())

    if normalized_channel == "calls":
        return [
            {
                **item,
                "activity_count": item["calls"],
            }
            for item in rows
        ]
    if normalized_channel == "email":
        return [
            {
                **item,
                "activity_count": item["emails"],
            }
            for item in rows
        ]
    if normalized_channel == "sms":
        return [
            {
                **item,
                "activity_count": item["sms"],
            }
            for item in rows
        ]
    return [
        {
            **item,
            "activity_count": item["calls"] + item["emails"] + item["sms"],
        }
        for item in rows
    ]


@router.get("/totals")
async def jobs_totals(
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    calls_total = (
        await db.execute(select(func.count(Call.id)).where(Call.org_id == org.id))
    ).scalar_one() or 0
    connected_total = (
        await db.execute(
            select(func.count(Call.id))
            .where(Call.org_id == org.id)
            .where((Call.duration > 0) | (Call.status.in_(["in-progress", "completed"])))
        )
    ).scalar_one() or 0
    conversation_total = (
        await db.execute(
            select(func.count(Call.id)).where(Call.org_id == org.id).where(Call.transcript.is_not(None))
        )
    ).scalar_one() or 0
    email_total = (
        await db.execute(
            select(func.count(ConversationMessage.id))
            .where(ConversationMessage.org_id == org.id)
            .where(ConversationMessage.sender_role.in_(["agent_ai", "agent_human"]))
            .where(ConversationMessage.channel == "email")
        )
    ).scalar_one() or 0
    sms_total = (
        await db.execute(
            select(func.count(ConversationMessage.id))
            .where(ConversationMessage.org_id == org.id)
            .where(ConversationMessage.sender_role.in_(["agent_ai", "agent_human"]))
            .where(ConversationMessage.channel.in_(["text", "sms"]))
        )
    ).scalar_one() or 0

    return {
        "calls": int(calls_total),
        "connected_calls": int(connected_total),
        "conversations": int(conversation_total),
        "emails": int(email_total),
        "sms": int(sms_total),
    }
