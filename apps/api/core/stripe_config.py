"""Stripe availability for billing routes (avoid 500s when keys are missing or invalid)."""

import stripe

from core.config import settings

STRIPE_NOT_CONFIGURED_MSG = (
    "Stripe billing is not configured on this server. "
    "Set STRIPE_SECRET_KEY (sk_test_… or sk_live_…) and STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO in the API environment, "
    "then enable the Customer billing portal in your Stripe Dashboard."
)


def is_stripe_configured() -> bool:
    key = (settings.STRIPE_SECRET_KEY or "").strip()
    if len(key) < 24:
        return False
    return key.startswith(("sk_test_", "sk_live_"))


def apply_stripe_api_key() -> None:
    """Set global Stripe API key when configured (no-op otherwise)."""
    if is_stripe_configured():
        stripe.api_key = (settings.STRIPE_SECRET_KEY or "").strip()
