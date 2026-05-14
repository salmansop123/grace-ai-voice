import base64
import hashlib
import hmac
import os

from fastapi import APIRouter, Body, HTTPException, status
from sqlalchemy import func, select

from core.database import AsyncSessionLocal
from models.dev_auth_user import DevAuthUser

router = APIRouter()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _hash_password(password: str, salt: bytes | None = None) -> str:
    actual_salt = salt or os.urandom(16)
    iterations = 200_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), actual_salt, iterations)
    return "pbkdf2_sha256${iterations}${salt}${digest}".format(
        iterations=iterations,
        salt=base64.urlsafe_b64encode(actual_salt).decode("ascii"),
        digest=base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def _verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations_raw, salt_b64, digest_b64 = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations_raw))
        return hmac.compare_digest(candidate, expected)
    except Exception:
        return False


@router.post("/sign-up")
async def dev_sign_up(payload: dict = Body(...)) -> dict:
    name = str(payload.get("name", "")).strip()
    email = _normalize_email(str(payload.get("email", "")))
    password = str(payload.get("password", ""))
    if not name or not email or len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="name, email and password (min 6 chars) are required",
        )

    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(DevAuthUser).where(func.lower(DevAuthUser.email) == email))
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = DevAuthUser(name=name, email=email, password_hash=_hash_password(password))
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return {"message": "Account created", "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.post("/sign-in")
async def dev_sign_in(payload: dict = Body(...)) -> dict:
    email = _normalize_email(str(payload.get("email", "")))
    password = str(payload.get("password", ""))
    if not email or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email and password are required")

    async with AsyncSessionLocal() as db:
        user = (
            await db.execute(select(DevAuthUser).where(func.lower(DevAuthUser.email) == email))
        ).scalar_one_or_none()
        if user is None or not _verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        return {"message": "Signed in", "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.post("/verify")
async def dev_verify(payload: dict = Body(...)) -> dict:
    email = _normalize_email(str(payload.get("email", "")))
    if not email:
        return {"exists": False}
    async with AsyncSessionLocal() as db:
        exists = (
            await db.execute(select(DevAuthUser.id).where(func.lower(DevAuthUser.email) == email))
        ).first()
    return {"exists": bool(exists)}


@router.post("/change-password")
async def dev_change_password(payload: dict = Body(...)) -> dict:
    """Update password_hash for dev-auth users stored in Postgres (dev_auth_users)."""
    email = _normalize_email(str(payload.get("email", "")))
    current_password = str(payload.get("current_password", ""))
    new_password = str(payload.get("new_password", ""))
    if not email or not current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="email and current_password are required",
        )
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_password must be at least 6 characters",
        )

    async with AsyncSessionLocal() as db:
        user = (
            await db.execute(select(DevAuthUser).where(func.lower(DevAuthUser.email) == email))
        ).scalar_one_or_none()
        if user is None or not _verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or current password",
            )
        user.password_hash = _hash_password(new_password)
        await db.commit()

    return {"message": "Password updated"}
