"""Ported from backend/src/analytics/analytics.controller.ts.

Admin-only - only the Admin Portal's AnalyticsDashboard calls this.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsSummaryOut, OfficerMonitoringEntryOut
from app.services import analytics_service as service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummaryOut)
def get_summary(db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    return service.get_summary(db)


@router.get("/officer-monitoring", response_model=list[OfficerMonitoringEntryOut])
def get_officer_monitoring(db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    return service.get_officer_monitoring(db)
