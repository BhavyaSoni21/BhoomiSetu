"""Public, unauthenticated aggregate stats for the marketing About page.

Only non-sensitive headline counts (parcels indexed, service requests
handled) - deliberately NOT the per-status/dispute/alert breakdowns, which
stay behind the admin-only /analytics/summary. Safe to serve without auth.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.parcel import Parcel
from app.models.workflow import Workflow
from app.schemas.base import CamelModel

router = APIRouter(prefix="/public", tags=["public"])


class PublicStatsOut(CamelModel):
    parcels: int
    service_requests: int


@router.get("/stats", response_model=PublicStatsOut)
def get_public_stats(db: Session = Depends(get_db)) -> PublicStatsOut:
    parcels = db.scalar(select(func.count()).select_from(Parcel)) or 0
    service_requests = db.scalar(select(func.count()).select_from(Workflow)) or 0
    return PublicStatsOut(parcels=parcels, service_requests=service_requests)
