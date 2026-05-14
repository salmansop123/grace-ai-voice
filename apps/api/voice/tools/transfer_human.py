import json
from typing import Any

from core.redis import redis_client


async def transfer_to_human(**kwargs: Any) -> dict[str, Any]:
    reason = kwargs.get("reason")
    if not reason:
        return {
            "status": "error",
            "tool": "transfer_to_human",
            "message": "Missing required field: reason",
        }

    org_id = kwargs.get("org_id")
    call_sid = kwargs.get("call_sid")
    if org_id and call_sid:
        await redis_client.setex(
            f"call:{org_id}:{call_sid}:transfer",
            3600,
            json.dumps(
                {
                    "department": kwargs.get("department", "general"),
                    "reason": reason,
                }
            ),
        )

    return {
        "status": "success",
        "tool": "transfer_to_human",
        "department": kwargs.get("department", "general"),
        "reason": reason,
        "message": "Call marked for human transfer.",
    }
