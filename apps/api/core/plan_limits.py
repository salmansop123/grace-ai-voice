from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import PLAN_LIMITS
from models.agent import Agent
from models.campaign import Campaign
from models.kb_document import KBDocument
from models.organization import Organization


def get_plan_limits(plan: str) -> dict[str, int]:
    return PLAN_LIMITS.get(plan.lower(), PLAN_LIMITS["free"])


def ensure_minutes_available(org: Organization) -> None:
    if int(org.minutes_used or 0) >= int(org.minutes_limit or 0):
        raise_plan_limit_exceeded(
            resource="minutes",
            limit=int(org.minutes_limit or 0),
            current=int(org.minutes_used or 0),
        )


def raise_plan_limit_exceeded(resource: str, limit: int, current: int) -> None:
    raise HTTPException(
        status_code=402,
        detail={
            "error": "plan_limit_exceeded",
            "resource": resource,
            "limit": int(limit),
            "current": int(current),
            "upgrade_url": "/dashboard/settings?tab=billing",
        },
    )


async def ensure_plan_resource_available(db: AsyncSession, org: Organization, resource: str) -> None:
    limits = get_plan_limits(org.plan)
    limit = int(limits.get(resource, 0))
    current = 0

    if resource == "agents":
        current = int(
            (
                await db.execute(
                    select(func.count(Agent.id)).where(Agent.org_id == org.id)
                )
            ).scalar_one()
            or 0
        )
    elif resource == "campaigns":
        current = int(
            (
                await db.execute(
                    select(func.count(Campaign.id)).where(Campaign.org_id == org.id)
                )
            ).scalar_one()
            or 0
        )
    elif resource == "kb_docs":
        current = int(
            (
                await db.execute(
                    select(func.count(KBDocument.id))
                    .join(Agent, Agent.id == KBDocument.agent_id)
                    .where(Agent.org_id == org.id)
                )
            ).scalar_one()
            or 0
        )
    else:
        return

    if current >= limit:
        raise_plan_limit_exceeded(resource=resource, limit=limit, current=current)
