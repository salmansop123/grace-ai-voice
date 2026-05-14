import asyncio

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from core.config import settings

twilio_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


async def place_call(from_number: str, to_number: str, twiml_url: str) -> str | None:
    try:
        call = await asyncio.to_thread(
            twilio_client.calls.create,
            from_=from_number,
            to=to_number,
            url=twiml_url,
        )
        return getattr(call, "sid", None)
    except Exception:
        return None


async def list_available_numbers(country_code: str = "US") -> list[str]:
    try:
        response = await asyncio.to_thread(
            twilio_client.available_phone_numbers(country_code).local.list,
            limit=10,
        )
        numbers = [item.phone_number for item in response if getattr(item, "phone_number", None)]
        if numbers:
            return numbers
    except Exception:
        pass
    return []


async def buy_number(phone_number: str) -> str:
    try:
        purchased = await asyncio.to_thread(
            twilio_client.incoming_phone_numbers.create,
            phone_number=phone_number,
        )
        return getattr(purchased, "phone_number", phone_number)
    except TwilioRestException:
        return phone_number
