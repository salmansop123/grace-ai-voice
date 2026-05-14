import time
import json
from uuid import uuid4

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi import HTTPException as FastAPIHTTPException
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_ipaddr

from core.config import settings
from core.database import check_db_connection, ensure_db_schema
from core.rate_limit import limiter
from core.redis import redis_client
from routers.agents import router as agents_router
from routers.analytics import router as analytics_router
from routers.billing import router as billing_router
from routers.calls import router as calls_router
from routers.campaigns import router as campaigns_router
from routers.contacts import router as contacts_router
from routers.customers import router as customers_router
from routers.dev_auth import router as dev_auth_router
from routers.inbox import router as inbox_router
from routers.jobs import router as jobs_router
from routers.knowledge_base import router as kb_router
from routers.phone_numbers import router as phone_router
from routers.schedule import router as schedule_router
from routers.stream import router as stream_router
from routers.webhooks.stripe import router as stripe_webhook_router
from routers.webhooks.twilio import router as twilio_webhook_router
from voice.websocket import voice_websocket_handler

app = FastAPI(title="Grace AI API", version="1.0.0")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    traces_sample_rate=0.1,
    environment=settings.ENVIRONMENT,
)
structlog.configure(processors=[structlog.processors.TimeStamper(fmt="iso"), structlog.processors.JSONRenderer()])
logger = structlog.get_logger()
DEBUG_LOG_PATH = "/home/salman-mazhar/Drive/Office Project/grace-ai/.cursor/debug-c1c8aa.log"


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "c1c8aa",
        "runId": "run-1",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    try:
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as file:
            file.write(json.dumps(payload) + "\n")
    except Exception:
        pass
@app.on_event("startup")
async def startup() -> None:
    logger.info("Grace AI API starting...")
    db_ok, db_error = await check_db_connection()
    if not db_ok:
        logger.critical(
            "STARTUP FAILED: Cannot connect to PostgreSQL. "
            "Check DATABASE_URL in .env. "
            "Format must be: postgresql+asyncpg://user:password@host:port/dbname. "
            f"Error: {db_error}"
        )
    else:
        logger.info("PostgreSQL connected OK")
        if settings.ENVIRONMENT != "production":
            schema_ok, schema_error = await ensure_db_schema()
            if not schema_ok:
                logger.error("DB schema bootstrap failed in dev mode: %s", schema_error)
            else:
                logger.info("DB schema bootstrap complete")

    try:
        await redis_client.ping()
        logger.info("Redis connected OK")
        # region agent log
        _debug_log("H3", "apps/api/main.py:82", "startup:redis_ok", {"redis": "ok"})
        # endregion
    except Exception as exc:
        logger.error(f"Redis connection failed: {exc}")
        # region agent log
        _debug_log("H3", "apps/api/main.py:87", "startup:redis_error", {"error_type": type(exc).__name__, "error": str(exc)})
        # endregion




async def rate_limit_exception_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    response = JSONResponse(
        status_code=429,
        content={
            "error": {
                "message": "Rate limit exceeded. Please retry later.",
                "request_id": request_id,
                "type": "rate_limit_exceeded",
            },
            "retry_after": 60,
        },
    )
    response.headers["x-request-id"] = request_id
    return response


app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)


@app.get("/")
async def api_root() -> dict[str, str]:
    return {"service": "Grace AI API", "docs": "/docs", "health": "/health"}


def _cors_allow_origins() -> list[str]:
    """Browser origin must be listed here. Local frontends include localhost ports 3000–3015."""
    configured = settings.NEXT_PUBLIC_APP_URL or settings.FRONTEND_URL
    primary = configured.strip().rstrip("/") if configured else ""
    local_frontend = primary.startswith(("http://localhost:", "http://127.0.0.1:"))
    strict_remote = settings.ENVIRONMENT == "production" and not local_frontend and bool(primary)

    if strict_remote:
        return [primary]

    allowed: set[str] = set()
    if primary:
        allowed.add(primary)
    for port in range(3000, 3016):
        allowed.add(f"http://localhost:{port}")
        allowed.add(f"http://127.0.0.1:{port}")
    return sorted(allowed)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
app.include_router(calls_router, prefix="/api/calls", tags=["calls"])
app.include_router(billing_router, prefix="/api/billing", tags=["billing"])
app.include_router(campaigns_router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(contacts_router, prefix="/api/contacts", tags=["contacts"])
app.include_router(customers_router, prefix="/api/customers", tags=["customers"])
app.include_router(dev_auth_router, prefix="/api/auth/dev", tags=["dev-auth"])
app.include_router(inbox_router, prefix="/api/inbox", tags=["inbox"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["jobs"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])
app.include_router(kb_router, prefix="/api/knowledge-base", tags=["knowledge-base"])
app.include_router(phone_router, prefix="/api/phone-numbers", tags=["phone-numbers"])
app.include_router(schedule_router, prefix="/api/schedule", tags=["schedule"])
app.include_router(stream_router, tags=["live"])
app.include_router(twilio_webhook_router, prefix="/webhooks/twilio", tags=["twilio-webhooks"])
app.include_router(stripe_webhook_router, prefix="/webhooks/stripe", tags=["stripe-webhooks"])
app.add_websocket_route("/ws/stream/{call_sid}", voice_websocket_handler)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    started = time.perf_counter()
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    request.state.client_ip = get_ipaddr(request)
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    logger.info(
        "http_request",
        request_id=request_id,
        path=request.url.path,
        method=request.method,
        status_code=response.status_code,
        duration_ms=duration_ms,
    )
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(FastAPIHTTPException)
async def http_exception_handler(request: Request, exc: FastAPIHTTPException):
    request_id = getattr(request.state, "request_id", str(uuid4()))
    if isinstance(exc.detail, dict):
        payload = dict(exc.detail)
        if "request_id" not in payload:
            payload["request_id"] = request_id
        return JSONResponse(status_code=exc.status_code, content=payload)
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": detail,
                "request_id": request_id,
                "type": "http_error",
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid4()))
    logger.exception(
        "unhandled_exception",
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": "Internal server error",
                "request_id": request_id,
                "type": "internal_error",
            }
        },
    )


@app.get("/health")
async def health() -> dict[str, str | None]:
    db_status = "connected"
    db_error: str | None = None
    redis_status = "connected"

    db_ok, db_error_msg = await check_db_connection()
    if not db_ok:
        db_status = "error"
        db_error = db_error_msg

    try:
        await redis_client.ping()
    except Exception:
        redis_status = "error"

    status = "ok" if db_status == "connected" else "degraded"
    # region agent log
    _debug_log(
        "H2",
        "apps/api/main.py:220",
        "health:computed_status",
        {"status": status, "db_status": db_status, "db_error": db_error, "redis_status": redis_status},
    )
    # endregion
    return {
        "status": status,
        "db": db_status,
        "db_error": db_error,
        "redis": redis_status,
        "version": "1.0.0",
    }
