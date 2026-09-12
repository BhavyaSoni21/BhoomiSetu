"""Ported from backend/src/predictive-analytics/predictive-analytics.controller.ts.

Admin-only (docs/FEATURE_AUDIT.md §8 item 5) - only the Admin Portal's
TopRiskParcels calls this. The single-parcel GET /parcels/:id/risk-score
route lives on app/routers/parcels.py instead and stays public - it's
shown to citizens on Parcel 360.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.database import get_db
from app.schemas.predictive_analytics import RiskScoreOut
from app.services import predictive_analytics_service as service

router = APIRouter(prefix="/predictive-analytics", tags=["predictive-analytics"])


@router.get("/top-risk-parcels", response_model=list[RiskScoreOut])
def get_top_risk_parcels(limit: int | None = None, db: Session = Depends(get_db), _admin=Depends(require_roles("ADMIN"))):
    return service.get_top_risk_parcels(db, limit)
