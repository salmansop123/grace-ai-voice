from celery import Celery

from core.config import settings

celery_app = Celery("grace_ai", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.task_serializer = "json"
celery_app.conf.task_routes = {
    "workers.campaign_worker.*": {"queue": "campaigns"},
    "workers.post_call_worker.*": {"queue": "post_call"},
}
