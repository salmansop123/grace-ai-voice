from twilio.rest import Client

from core.config import settings


async def send_sms(**kwargs: str) -> dict[str, str]:
    to = kwargs.get("to")
    message = kwargs.get("message")
    from_number = kwargs.get("from_number")

    if not to or not message:
        return {
            "status": "error",
            "tool": "send_sms",
            "message": "Missing required 'to' or 'message'.",
        }

    if not from_number:
        return {
            "status": "error",
            "tool": "send_sms",
            "message": "Missing 'from_number'. Configure an agent phone number first.",
        }

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        result = client.messages.create(to=to, from_=from_number, body=message)
        return {
            "status": "success",
            "tool": "send_sms",
            "sid": result.sid,
            "to": to,
        }
    except Exception as exc:
        return {
            "status": "error",
            "tool": "send_sms",
            "message": f"SMS failed: {exc}",
            "to": to,
        }
