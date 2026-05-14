import asyncio
from uuid import uuid4

from redis import Redis
from sqlalchemy import select
from twilio.rest import Client

from core.config import settings
from core.database import AsyncSessionLocal
from models.agent import Agent
from models.call import Call
from models.campaign import Campaign
from models.contact import Contact
from workers.celery_app import celery_app

redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def dial_contact(self: object, contact_id: str, agent_id: str, org_id: str, campaign_id: str) -> dict[str, str]:
    async def _run() -> dict[str, str]:
        async with AsyncSessionLocal() as db:
            contact = await db.get(Contact, contact_id)
            agent = await db.get(Agent, agent_id)
            campaign = await db.get(Campaign, campaign_id)
            if not contact or not agent or not campaign or not agent.phone_number:
                return {"message": "skipped"}

            rate_key = f"ratelimit:calls:{org_id}"
            current = redis_client.incr(rate_key)
            redis_client.expire(rate_key, 3600)
            if current > 10:
                redis_client.decr(rate_key)
                raise self.retry(countdown=30)

            try:
                twiml_url = (
                    f"{settings.BACKEND_URL}/webhooks/twilio/outbound-twiml"
                    f"?agent_id={agent_id}&org_id={org_id}"
                )
                try:
                    tw_call = twilio_client.calls.create(
                        to=contact.phone,
                        from_=agent.phone_number,
                        url=twiml_url,
                        method="POST",
                        status_callback=f"{settings.BACKEND_URL}/webhooks/twilio/status",
                        status_callback_method="POST",
                    )
                    twilio_sid = tw_call.sid
                except Exception:
                    twilio_sid = f"queued-{uuid4()}"

                db.add(
                    Call(
                        org_id=org_id,
                        agent_id=agent_id,
                        twilio_call_sid=twilio_sid,
                        direction="OUTBOUND",
                        from_number=agent.phone_number,
                        to_number=contact.phone,
                        status="initiated",
                    )
                )
                campaign.calls_made = (campaign.calls_made or 0) + 1
                await db.commit()
            finally:
                redis_client.decr(rate_key)
        return {"message": "dial queued"}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def launch_campaign_contacts(self: object, campaign_id: str, org_id: str) -> dict[str, str]:
    async def _run() -> dict[str, str]:
        async with AsyncSessionLocal() as db:
            campaign = await db.get(Campaign, campaign_id)
            if not campaign or campaign.org_id != org_id:
                return {"message": "campaign not found"}

            campaign.status = "running"
            await db.commit()

            for index, contact_id in enumerate(campaign.contact_ids or []):
                dial_contact.apply_async(
                    args=[contact_id, campaign.agent_id, org_id, campaign_id],
                    queue="campaigns",
                    countdown=index * 3,
                )
        return {"message": "campaign launch scheduled"}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc)
