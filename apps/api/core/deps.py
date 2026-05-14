from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser, get_current_user
from core.database import get_db_session
from models.organization import Organization


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db_session():
        yield session


async def get_current_org(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Organization:
    try:
        result = await db.execute(
            select(Organization).where(Organization.clerk_org_id == user.org_id)
        )
        org = result.scalar_one_or_none()
        if org is None:
            org = Organization(
                clerk_org_id=user.org_id,
                name=user.org_name or "My Organization",
                plan="free",
                minutes_limit=100,
            )
            db.add(org)
            await db.commit()
            await db.refresh(org)
        return org
    except ConnectionRefusedError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "database_unavailable",
                "message": "Database is not reachable. Check DATABASE_URL configuration.",
                "hint": "Ensure PostgreSQL is running and DATABASE_URL uses postgresql+asyncpg:// scheme",
            },
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "db_error", "message": str(exc)},
        ) from exc


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    role = str(user.org_role).lower()
    if role not in {"admin", "org:admin", "owner", "org:owner"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user
