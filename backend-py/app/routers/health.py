from datetime import datetime, timezone

from fastapi import APIRouter

# Mirrors backend/src/health/health.controller.ts: plain process-liveness
# only (no DB round trip), mounted outside the /api/v1 prefix (see
# app/main.py) so it's a stable, version-independent path for infra to poll.
router = APIRouter(tags=["health"])


@router.get("/health")
def check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
