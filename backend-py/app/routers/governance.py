"""Ported from backend/src/governance/governance-alerts.controller.ts.

Officer/admin-only throughout (docs/FEATURE_AUDIT.md §8 item 5) - there
is no citizen-facing use of governance alerts anywhere in the frontend.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.roles import ALL_STAFF_ROLES
from app.database import get_db
from app.models.governance import GovernanceAlert
from app.models.user import User
from app.schemas.governance import GovernanceAlertOut, UpdateGovernanceAlertStatus
from app.services import audit_service, governance_alerts_service as service

router = APIRouter(prefix="/governance-alerts", tags=["governance"])


def _to_out(alert: GovernanceAlert) -> GovernanceAlertOut:
    out = GovernanceAlertOut.model_validate(alert)
    out.department = service.alert_department_for(alert.alert_type)
    return out


@router.get("", response_model=list[GovernanceAlertOut])
def find_all(
    status_: str | None = Query(None, alias="status"),
    severity: str | None = None,
    department: str | None = None,
    db: Session = Depends(get_db),
    _staff: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    # Deliberately NOT scoped to the caller's own department by default -
    # every staff role sees every alert (confirmed by this endpoint's own
    # existing test suite, tests/routers/test_governance.py::TestFindAll,
    # which asserts a single-department officer sees alerts from every
    # department). `department` is opt-in narrowing only, for callers (e.g.
    # a department-specific dashboard widget) that want to filter.
    alerts = service.find_all(db, status_, severity, department)
    return [_to_out(alert) for alert in alerts]


@router.get("/{id}", response_model=GovernanceAlertOut)
def find_one(id: UUID, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    alert = service.find_one(db, str(id))
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Governance alert not found: {id}")
    return _to_out(alert)


@router.patch("/{id}/status", response_model=GovernanceAlertOut)
def update_status(id: UUID, dto: UpdateGovernanceAlertStatus, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    try:
        alert = service.update_status(db, str(id), dto.status, dto.reason)
    except service.InvalidTransitionError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error.message) from error
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Governance alert not found: {id}")

    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="GOVERNANCE_ALERT_STATUS_CHANGED", entity_type="GOVERNANCE_ALERT",
        entity_id=str(id), parcel_id=alert.parcel_id, metadata={"status": dto.status, "reason": dto.reason},
    )
    return _to_out(alert)
