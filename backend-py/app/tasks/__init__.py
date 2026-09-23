"""Celery tasks package."""

from app.core.celery_app import celery_app

# Import tasks to register them
from app.tasks import earth_engine_tasks  # noqa: F401
from app.tasks import ocr_tasks  # noqa: F401
from app.tasks import etl_tasks  # noqa: F401
from app.tasks import change_detection_tasks  # noqa: F401
from app.tasks import terrain_tasks  # noqa: F401
from app.tasks import legal_status_tasks  # noqa: F401
from app.tasks import value_band_tasks  # noqa: F401
from app.tasks import risk_score_tasks  # noqa: F401