from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def _org_or_ip_key(request: Request) -> str:
    org_id = request.headers.get("x-org-id")
    if org_id:
        return f"org:{org_id}"
    return get_remote_address(request)


limiter = Limiter(key_func=_org_or_ip_key)

__all__ = ["limiter", "RateLimitExceeded"]
