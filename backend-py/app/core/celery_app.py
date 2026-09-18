"""Celery configuration for background job processing."""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "bhoomisetu",
    broker=settings.redis_url,
    backend=settings.redis_url,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

# Task routes for different queues
celery_app.conf.task_routes = {
    "app.tasks.earth_engine.*": {"queue": "earth_engine"},
    "app.tasks.ocr.*": {"queue": "ocr"},
    "app.tasks.etl.*": {"queue": "etl"},
    "app.tasks.change_detection.*": {"queue": "change_detection"},
}

# Task execution settings
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1
celery_app.conf.task_reject_on_worker_lost = True

# Result backend settings
celery_app.conf.result_expires = 3600  # 1 hour
celery_app.conf.result_compression = "gzip"