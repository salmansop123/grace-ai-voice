from collections.abc import AsyncGenerator
import json
import logging
from time import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
DEBUG_LOG_PATH = "/home/salman-mazhar/Drive/Office Project/grace-ai/.cursor/debug-c1c8aa.log"


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "c1c8aa",
        "runId": "run-1",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time() * 1000),
    }
    try:
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as file:
            file.write(json.dumps(payload) + "\n")
    except Exception:
        pass


class Base(DeclarativeBase):
    pass


db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    db_url,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    echo=False,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> tuple[bool, str | None]:
    # region agent log
    _debug_log(
        "H1",
        "apps/api/core/database.py:70",
        "check_db_connection:start",
        {"db_url_prefix": db_url.split("@")[0].split("://")[0], "has_asyncpg": "+asyncpg" in db_url},
    )
    # endregion
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        # region agent log
        _debug_log(
            "H2",
            "apps/api/core/database.py:79",
            "check_db_connection:success",
            {"result": "ok"},
        )
        # endregion
        return True, None
    except Exception as exc:
        logger.error("DB connection check failed: %s", exc)
        # region agent log
        _debug_log(
            "H2",
            "apps/api/core/database.py:89",
            "check_db_connection:exception",
            {"error_type": type(exc).__name__, "error": str(exc)},
        )
        # endregion
        return False, str(exc)


async def ensure_db_schema() -> tuple[bool, str | None]:
    """
    Best-effort schema bootstrap for local/dev environments.
    """
    try:
        # Import models so SQLAlchemy metadata includes all tables before create_all.
        import models  # noqa: F401

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return True, None
    except Exception as exc:
        logger.error("DB schema bootstrap failed: %s", exc)
        return False, str(exc)
