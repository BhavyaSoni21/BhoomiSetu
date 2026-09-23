"""Ported from backend/src/analytics/analytics.controller.ts.

Admin-only - only the Admin Portal's AnalyticsDashboard calls this.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.roles import OFFICER_ROLES
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


@router.get("/my-performance", response_model=OfficerMonitoringEntryOut)
def get_my_performance(db: Session = Depends(get_db), user: User = Depends(require_roles(*OFFICER_ROLES))):
    """An officer's own performance row - same metrics as the admin monitoring
    table, filtered to the signed-in officer (their own Performance tab)."""
    mine = next((e for e in service.get_officer_monitoring(db) if e.user_id == str(user.id)), None)
    if mine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No performance record for this officer yet")
    return mine
