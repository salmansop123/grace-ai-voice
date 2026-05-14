from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from core.config import settings
from core.deps import get_current_org, get_db, require_admin
from core.plan_limits import get_plan_limits
from core.stripe_config import STRIPE_NOT_CONFIGURED_MSG, apply_stripe_api_key, is_stripe_configured
from models.agent import Agent
from models.campaign import Campaign
from models.kb_document import KBDocument
from models.organization import Organization

router = APIRouter()


def _require_stripe() -> None:
    if not is_stripe_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=STRIPE_NOT_CONFIGURED_MSG)
    apply_stripe_api_key()


def _stripe_http_exception(exc: stripe.error.StripeError) -> HTTPException:
    err = getattr(exc, "user_message", None) or getattr(exc, "message", None) or str(exc)
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=err)


def _normalize_price_id(price_id: str) -> str:
    lowered = price_id.lower()
    if lowered == "starter" and settings.STRIPE_PRICE_STARTER:
        return settings.STRIPE_PRICE_STARTER
    if lowered == "pro" and settings.STRIPE_PRICE_PRO:
        return settings.STRIPE_PRICE_PRO
    return price_id


def _price_to_plan(price_id: str) -> tuple[str, int]:
    if settings.STRIPE_PRICE_PRO and price_id == settings.STRIPE_PRICE_PRO:
        return ("pro", 2000)
    if settings.STRIPE_PRICE_STARTER and price_id == settings.STRIPE_PRICE_STARTER:
        return ("starter", 500)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported price_id")


@router.post("/create-checkout")
async def create_checkout(
    payload: dict = Body(...),
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
) -> dict:
    _require_stripe()
    plan = str(payload.get("plan", "")).strip().lower()
    price_id = str(payload.get("price_id", "")).strip()
    if not price_id and plan:
        price_id = plan
    if not price_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="price_id or plan is required")
    price_id = _normalize_price_id(price_id)
    _price_to_plan(price_id)

    success_url = f"{settings.FRONTEND_URL}/dashboard/settings?tab=billing&success=1"
    cancel_url = f"{settings.FRONTEND_URL}/dashboard/settings?tab=billing&cancel=1"
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"org_id": org.id, "clerk_org_id": org.clerk_org_id, "price_id": price_id},
        )
    except stripe.error.StripeError as exc:
        raise _stripe_http_exception(exc) from exc
    return {"url": session.url}


@router.post("/portal")
async def create_billing_portal(
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
    _admin: object = Depends(require_admin),
) -> dict:
    _require_stripe()
    customer_id = org.stripe_id
    try:
        if not customer_id:
            customer = stripe.Customer.create(
                name=org.name,
                metadata={"org_id": org.id, "clerk_org_id": org.clerk_org_id},
            )
            customer_id = customer.id
            org.stripe_id = customer_id
            await db.commit()

        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.FRONTEND_URL}/dashboard/settings?tab=billing",
        )
    except stripe.error.StripeError as exc:
        raise _stripe_http_exception(exc) from exc
    return {"url": session.url}


@router.get("/usage")
async def billing_usage(
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    used = int(org.minutes_used or 0)
    limit = max(1, int(org.minutes_limit or 1))
    plan_limits = get_plan_limits(org.plan)
    agents_count = int(
        (await db.execute(select(func.count(Agent.id)).where(Agent.org_id == org.id))).scalar_one()
        or 0
    )
    campaigns_count = int(
        (await db.execute(select(func.count(Campaign.id)).where(Campaign.org_id == org.id))).scalar_one()
        or 0
    )
    kb_docs_count = int(
        (
            await db.execute(
                select(func.count(KBDocument.id))
                .join(Agent, Agent.id == KBDocument.agent_id)
                .where(Agent.org_id == org.id)
            )
        ).scalar_one()
        or 0
    )
    return {
        "minutes_used": used,
        "minutes_limit": limit,
        "plan": org.plan,
        "percent": round((used / limit) * 100, 2),
        "renewal_date": None,
        "agents_count": agents_count,
        "campaigns_count": campaigns_count,
        "kb_docs_count": kb_docs_count,
        "limits": {
            "agents": int(plan_limits["agents"]),
            "campaigns": int(plan_limits["campaigns"]),
            "kb_docs": int(plan_limits["kb_docs"]),
            "minutes": int(plan_limits["minutes"]),
        },
    }


@router.get("/invoices")
async def list_invoices(org: Organization = Depends(get_current_org)) -> list[dict]:
    if not org.stripe_id or not is_stripe_configured():
        return []
    apply_stripe_api_key()
    try:
        invoices = stripe.Invoice.list(customer=org.stripe_id, limit=5)
    except stripe.error.StripeError:
        return []
    rows: list[dict] = []
    for invoice in invoices.data:
        rows.append(
            {
                "id": invoice.id,
                "date": invoice.created,
                "amount": (invoice.amount_paid or invoice.amount_due or 0) / 100,
                "status": invoice.status,
                "pdf_url": invoice.hosted_invoice_url,
            }
        )
    return rows
