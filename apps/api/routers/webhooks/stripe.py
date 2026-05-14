from fastapi import APIRouter, HTTPException, Request, status
import stripe
from sqlalchemy import select

from core.config import settings
from core.database import AsyncSessionLocal
from core.stripe_config import apply_stripe_api_key, is_stripe_configured
from models.organization import Organization

router = APIRouter()


def _apply_plan_from_price(org: Organization, price_id: str | None) -> None:
    if settings.STRIPE_PRICE_PRO and price_id == settings.STRIPE_PRICE_PRO:
        org.plan = "pro"
        org.minutes_limit = 2000
    elif settings.STRIPE_PRICE_STARTER and price_id == settings.STRIPE_PRICE_STARTER:
        org.plan = "starter"
        org.minutes_limit = 500
    else:
        org.plan = "free"
        org.minutes_limit = 100


@router.post("")
async def stripe_webhook(request: Request) -> dict[str, str]:
    if not is_stripe_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhooks are not configured (missing or invalid API keys).",
        )
    apply_stripe_api_key()
    wh_secret = (settings.STRIPE_WEBHOOK_SECRET or "").strip()
    if not wh_secret.startswith("whsec_") or len(wh_secret) < 16:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="STRIPE_WEBHOOK_SECRET is not set or invalid.",
        )

    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing stripe signature")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=wh_secret,
            tolerance=300,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook") from exc

    event_type = event.get("type", "")
    data_obj = event.get("data", {}).get("object", {})

    async with AsyncSessionLocal() as db:
        if event_type == "checkout.session.completed":
            metadata = data_obj.get("metadata", {}) or {}
            org_id = metadata.get("org_id")
            price_id = metadata.get("price_id")
            if org_id:
                result = await db.execute(select(Organization).where(Organization.id == org_id))
                org = result.scalar_one_or_none()
                if org:
                    org.stripe_id = data_obj.get("customer")
                    _apply_plan_from_price(org, price_id)
                    await db.commit()

        elif event_type == "customer.subscription.updated":
            customer_id = data_obj.get("customer")
            items = (data_obj.get("items") or {}).get("data") or []
            first_item = items[0] if isinstance(items, list) and items else {}
            price_id = ((first_item or {}).get("price") or {}).get("id")
            if customer_id:
                result = await db.execute(
                    select(Organization).where(Organization.stripe_id == customer_id)
                )
                org = result.scalar_one_or_none()
                if org:
                    _apply_plan_from_price(org, price_id)
                    await db.commit()

        elif event_type == "customer.subscription.deleted":
            customer_id = data_obj.get("customer")
            if customer_id:
                result = await db.execute(
                    select(Organization).where(Organization.stripe_id == customer_id)
                )
                org = result.scalar_one_or_none()
                if org:
                    org.plan = "free"
                    org.minutes_limit = 100
                    org.minutes_used = 0
                    await db.commit()

        elif event_type == "invoice.payment_failed":
            # Non-blocking event; currently only acknowledged.
            pass

    return {"message": "ok"}
