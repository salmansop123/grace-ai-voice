from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from core.redis import redis_client
from core.stripe_config import is_stripe_configured
from models.campaign import Campaign
from models.call import Call
from models.organization import Organization

router = APIRouter()


@router.get("/summary")
async def summary(
    org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)
) -> dict:
    stats_query = await db.execute(
        select(
            func.count(Call.id),
            func.coalesce(func.sum(case((Call.outcome == "booked", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Call.outcome == "lead", 1), else_=0)), 0),
            func.coalesce(func.avg(Call.duration), 0.0),
        ).where(Call.org_id == org.id)
    )
    total_calls, booked_count, lead_count, avg_duration = stats_query.one()

    return {
        "calls_total": int(total_calls or 0),
        "appointments_booked": int(booked_count or 0),
        "leads_captured": int(lead_count or 0),
        "avg_duration_seconds": int(avg_duration or 0),
    }


@router.get("/system-status")
async def system_status(
    org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)
) -> dict:
    _ = db
    try:
        redis_ok = bool(await redis_client.ping())
    except Exception:
        redis_ok = False

    return {
        "org_id": org.id,
        "org_name": org.name,
        "plan": org.plan,
        "minutes_used": org.minutes_used,
        "minutes_limit": org.minutes_limit,
        "integrations": {
            "twilio_connected": bool(org.twilio_acc_sid),
            "redis_connected": redis_ok,
            "stripe_connected": is_stripe_configured(),
        },
    }


@router.get("/ops-overview")
async def ops_overview(
    org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)
) -> dict:
    calls_stats_query = await db.execute(
        select(
            func.coalesce(func.sum(case((Call.status == "queued", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Call.status == "failed", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Call.status == "completed", 1), else_=0)), 0),
        ).where(Call.org_id == org.id)
    )
    queued_calls, failed_calls, completed_calls = calls_stats_query.one()

    campaign_stats_query = await db.execute(
        select(
            func.coalesce(func.sum(case((Campaign.status == "running", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Campaign.status == "paused", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Campaign.status == "draft", 1), else_=0)), 0),
        ).where(Campaign.org_id == org.id)
    )
    running_campaigns, paused_campaigns, draft_campaigns = campaign_stats_query.one()

    recent_calls_result = await db.execute(
        select(Call)
        .where(Call.org_id == org.id)
        .order_by(Call.created_at.desc())
        .limit(12)
    )
    recent_calls = recent_calls_result.scalars().all()

    return {
        "calls": {
            "queued": int(queued_calls or 0),
            "failed": int(failed_calls or 0),
            "completed": int(completed_calls or 0),
        },
        "campaigns": {
            "running": int(running_campaigns or 0),
            "paused": int(paused_campaigns or 0),
            "draft": int(draft_campaigns or 0),
        },
        "recent_calls": [
            {
                "id": call.id,
                "to_number": call.to_number,
                "status": call.status,
                "outcome": call.outcome,
                "created_at": call.created_at.isoformat(),
            }
            for call in recent_calls
        ],
    }
