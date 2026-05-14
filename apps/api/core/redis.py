from redis.asyncio import ConnectionPool, Redis

from core.config import settings

redis_pool = ConnectionPool.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=20,
)
redis_client = Redis(connection_pool=redis_pool)
