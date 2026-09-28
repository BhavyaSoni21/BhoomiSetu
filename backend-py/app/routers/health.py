from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

# Mirrors backend/src/health/health.controller.ts: plain process-liveness
# only (no DB round trip), mounted outside the /api/v1 prefix (see
# app/main.py) so it's a stable, version-independent path for infra to poll.
router = APIRouter(tags=["health"])


@router.get("/health")
def check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/health/ready")
def ready(response: Response, db: Session = Depends(get_db)):
    """Readiness probe (DEP-01): liveness alone doesn't mean the app can serve
    traffic. Confirm the DB is reachable so a load balancer doesn't route to an
    instance whose database connection is down."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "db": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as exc:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "db": f"error: {type(exc).__name__}", "timestamp": datetime.now(timezone.utc).isoformat()}
