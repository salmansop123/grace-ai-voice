import json
from typing import Any

from core.redis import redis_client


async def end_call(**kwargs: Any) -> dict[str, Any]:
    reason = kwargs.get("reason")
    outcome = kwargs.get("outcome")
    allowed = {"booked", "lead", "no-answer", "transferred", "completed"}

    if not reason or not outcome:
        return {
            "status": "error",
            "tool": "end_call",
            "message": "Missing required fields: reason and outcome",
        }
    if outcome not in allowed:
        return {
            "status": "error",
            "tool": "end_call",
            "message": f"Invalid outcome '{outcome}'",
        }

    org_id = kwargs.get("org_id")
    call_sid = kwargs.get("call_sid")
    if org_id and call_sid:
        await redis_client.setex(
            f"call:{org_id}:{call_sid}:final_outcome",
            3600,
            json.dumps({"reason": reason, "outcome": outcome}),
        )

    return {
        "status": "success",
        "tool": "end_call",
        "reason": reason,
        "outcome": outcome,
        "message": "Call marked for completion.",
    }
