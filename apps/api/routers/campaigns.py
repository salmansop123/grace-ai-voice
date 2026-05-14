from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from core.plan_limits import ensure_plan_resource_available
from core.rate_limit import limiter
from models.agent import Agent
from models.campaign import Campaign
from models.contact import Contact
from models.organization import Organization
from schemas.campaign import CampaignCreate
from workers.campaign_worker import launch_campaign_contacts

router = APIRouter()


@router.get("")
async def list_campaigns(
    org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    result = await db.execute(
        select(Campaign).where(Campaign.org_id == org.id).order_by(desc(Campaign.created_at)).limit(200)
    )
    campaigns = result.scalars().all()
    return [
        {
            "id": campaign.id,
            "agent_id": campaign.agent_id,
            "name": campaign.name,
            "status": campaign.status,
            "scheduled": campaign.scheduled.isoformat() if campaign.scheduled else None,
            "contact_ids": campaign.contact_ids or [],
            "calls_made": campaign.calls_made,
            "created_at": campaign.created_at.isoformat(),
        }
        for campaign in campaigns
    ]


@router.post("")
async def create_campaign(
    payload: CampaignCreate,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await ensure_plan_resource_available(db, org, "campaigns")
    agent_result = await db.execute(
        select(Agent).where(Agent.id == payload.agent_id, Agent.org_id == org.id)
    )
    agent = agent_result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid agent_id for this org")
    if not payload.contact_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one contact is required")

    unique_contact_ids = list(dict.fromkeys(payload.contact_ids))
    contact_rows = (
        await db.execute(
            select(Contact.id).where(Contact.org_id == org.id, Contact.id.in_(unique_contact_ids))
        )
    ).scalars().all()
    if len(contact_rows) != len(unique_contact_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more contact_ids are invalid for this org",
        )

    campaign = Campaign(
        org_id=org.id,
        agent_id=payload.agent_id,
        name=payload.name,
        contact_ids=unique_contact_ids,
        scheduled=payload.scheduled,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return {
        "id": campaign.id,
        "agent_id": campaign.agent_id,
        "name": campaign.name,
        "status": campaign.status,
        "scheduled": campaign.scheduled.isoformat() if campaign.scheduled else None,
        "contact_ids": campaign.contact_ids or [],
        "calls_made": campaign.calls_made,
        "created_at": campaign.created_at.isoformat(),
    }


@router.put("/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    new_status = payload.get("status")
    allowed = {"draft", "running", "paused", "completed"}
    if new_status not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid campaign status")

    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.org_id == org.id)
    )
    campaign = result.scalar_one_or_none()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    campaign.status = new_status
    await db.commit()
    return {"message": "Campaign status updated", "id": campaign.id, "status": campaign.status}


@router.post("/{campaign_id}/launch")
@limiter.limit("5/minute")
async def launch_campaign(
    request: Request,
    campaign_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.org_id == org.id)
    )
    campaign = campaign_result.scalar_one_or_none()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    agent_result = await db.execute(
        select(Agent).where(Agent.id == campaign.agent_id, Agent.org_id == org.id)
    )
    agent = agent_result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Campaign agent not found")

    contacts_result = await db.execute(
        select(Contact).where(Contact.org_id == org.id, Contact.id.in_(campaign.contact_ids))
    )
    contacts = contacts_result.scalars().all()
    if not contacts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No contacts found for campaign")

    campaign.status = "running"
    await db.commit()
    launch_campaign_contacts.delay(campaign.id, org.id)
    return {"message": "Campaign launch scheduled", "id": campaign.id, "queued_calls": len(contacts)}
