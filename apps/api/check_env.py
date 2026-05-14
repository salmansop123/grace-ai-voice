#!/usr/bin/env python3
"""Run this before starting the server to verify all env vars and connectivity."""

import asyncio
import os
import sys

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

if load_dotenv:
    load_dotenv()

required = [
    "DATABASE_URL",
    "REDIS_URL",
    "CLERK_SECRET_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "ELEVENLABS_API_KEY",
    "DEEPGRAM_API_KEY",
    "OPENAI_API_KEY",
]

print("=== Grace AI Environment Check ===\n")
missing: list[str] = []
for var in required:
    val = os.getenv(var, "")
    if not val or val.startswith("your_"):
        print(f"  x {var}: MISSING or placeholder")
        missing.append(var)
    else:
        masked = val[:8] + "..." if len(val) > 8 else "***"
        print(f"  ok {var}: {masked}")

if missing:
    print(f"\nERROR: {len(missing)} variables missing. Set them in .env before starting.")
    sys.exit(1)

db_url = os.getenv("DATABASE_URL", "")
if "postgresql://" in db_url and "+asyncpg" not in db_url and "postgres://" not in db_url:
    print("\nWARNING: DATABASE_URL should use postgresql+asyncpg:// for async SQLAlchemy")
    print(f"Current: {db_url[:40]}...")
    print(f"Fix to:  {db_url.replace('postgresql://', 'postgresql+asyncpg://', 1)[:40]}...")


async def test_db() -> bool:
    try:
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
            "postgres://", "postgresql+asyncpg://", 1
        )
        eng = create_async_engine(url, pool_timeout=5)
        async with eng.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await eng.dispose()
        print("\n  ok PostgreSQL: connected")
        return True
    except Exception as exc:
        print(f"\n  x PostgreSQL: {exc}")
        print("    -> Is PostgreSQL running? Is the host/port/user/password correct?")
        return False


ok = asyncio.run(test_db())
if ok:
    print("\nAll checks passed. You can start the server.")
else:
    print("\nDB check failed. Fix connection before starting.")
    sys.exit(1)
