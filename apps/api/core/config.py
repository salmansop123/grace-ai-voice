from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PLAN_LIMITS: dict[str, dict[str, int]] = {
    "free": {"minutes": 100, "agents": 1, "campaigns": 0, "kb_docs": 5},
    "starter": {"minutes": 500, "agents": 3, "campaigns": 5, "kb_docs": 50},
    "pro": {"minutes": 2000, "agents": 10, "campaigns": 20, "kb_docs": 200},
    "enterprise": {"minutes": 99999, "agents": 99999, "campaigns": 99999, "kb_docs": 99999},
}


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_API_KEY: str
    TWILIO_API_SECRET: str
    ELEVENLABS_API_KEY: str
    DEEPGRAM_API_KEY: str
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_STARTER: str | None = None
    STRIPE_PRICE_PRO: str | None = None
    R2_ACCOUNT_ID: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_BUCKET_NAME: str
    PINECONE_API_KEY: str
    PINECONE_INDEX: str
    FRONTEND_URL: str = Field(validation_alias=AliasChoices("FRONTEND_URL", "NEXT_PUBLIC_APP_URL"))
    NEXT_PUBLIC_APP_URL: str | None = None
    BACKEND_URL: str
    ENVIRONMENT: str = "development"
    DEV_AUTH_BYPASS: bool = True
    SENTRY_DSN: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")



@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
