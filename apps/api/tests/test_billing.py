import pytest


@pytest.mark.skip(reason="Requires Stripe mocking and authenticated organization fixture.")
def test_checkout_creates_stripe_session() -> None:
    pass


@pytest.mark.skip(reason="Requires Stripe webhook fixture and DB integration.")
def test_stripe_webhook_updates_plan() -> None:
    pass
