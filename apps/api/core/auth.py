from dataclasses import dataclass

import httpx
from fastapi import Header, HTTPException, Request, status
from jose import JWTError, jwt

from core.config import settings


@dataclass
class CurrentUser:
    user_id: str
    org_id: str
    org_role: str = "member"
    org_name: str | None = None


def _get_rsa_signing_key(token: str, jwks: dict) -> dict:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token key id")

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signing key not found")


async def _fetch_org_role(user_id: str, org_id: str, request_id: str | None = None) -> str:
    clerk_headers = {"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"}
    if request_id:
        clerk_headers["x-request-id"] = request_id
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"https://api.clerk.com/v1/organizations/{org_id}/memberships",
                headers=clerk_headers,
                params={"limit": 100},
            )
            response.raise_for_status()
            memberships = response.json() if isinstance(response.json(), list) else []
        for membership in memberships:
            public_user_data = membership.get("public_user_data", {}) if isinstance(membership, dict) else {}
            if public_user_data.get("user_id") == user_id:
                role = str(membership.get("role", "member"))
                return role
    except Exception:
        return "member"
    return "member"


async def get_current_user(request: Request, authorization: str | None = Header(None)) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        if settings.ENVIRONMENT != "production" and settings.DEV_AUTH_BYPASS:
            dev_org_id = request.headers.get("x-dev-org-id", "org_dev")
            return CurrentUser(
                user_id="dev_user",
                org_id=dev_org_id,
                org_role="org:admin",
                org_name="Development Organization",
            )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth header")

    token = authorization.replace("Bearer ", "", 1)
    request_id = request.headers.get("x-request-id")
    clerk_headers = {"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"}
    if request_id:
        clerk_headers["x-request-id"] = request_id
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://api.clerk.com/v1/jwks",
                headers=clerk_headers,
            )
            response.raise_for_status()
            jwks = response.json()

        signing_key = _get_rsa_signing_key(token, jwks)
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except (JWTError, ValueError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = claims.get("sub")
    org_id = claims.get("org_id")
    org_role = str(claims.get("org_role") or claims.get("role") or "member")
    org_name = claims.get("org_name")
    if not user_id or not org_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing required claims")
    if org_role == "member":
        org_role = await _fetch_org_role(str(user_id), str(org_id), request_id=request_id)
    return CurrentUser(user_id=str(user_id), org_id=str(org_id), org_role=org_role, org_name=str(org_name) if org_name else None)
