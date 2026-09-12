"""Ported from backend/src/governance/governance-alerts.service.ts."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.roles import DEPARTMENT_ROLE
from app.models.governance import GovernanceAlert
from app.models.user import User
from app.services import notification_feed_service
from app.services.notification_feed_service import NotificationPayload

# Four verification stages (docs/ADMIN_PANEL_ISSUES.md Officer #4): a linear
# OPEN -> ACKNOWLEDGED -> FIELD_VERIFIED -> RESOLVED progression, with
# DISMISSED reachable from any of the first three as an early exit for a
# false alarm. RESOLVED/DISMISSED are terminal - an empty list here, same
# as WorkflowsService.reviewStep's "a step can only be decided once" rule
# will be once WorkflowsModule exists.
VALID_TRANSITIONS: dict[str, list[str]] = {
    "OPEN": ["ACKNOWLEDGED", "DISMISSED"],
    "ACKNOWLEDGED": ["FIELD_VERIFIED", "DISMISSED"],
    "FIELD_VERIFIED": ["RESOLVED", "DISMISSED"],
    "RESOLVED": [],
    "DISMISSED": [],
}

# Alerts still needing attention - OPEN/ACKNOWLEDGED/FIELD_VERIFIED, i.e.
# anything not yet closed. Used both by find_all's status=ACTIVE special
# case and by AnalyticsModule's future "Open Alerts" total.
CLOSED_ALERT_STATUSES = ["RESOLVED", "DISMISSED"]

# Which department an alert concerns, derived from its existing alert_type -
# no new manual field needed. Used to notify that department's officer(s)
# when the alert is reviewed/dismissed, and to show a department badge on
# the frontend. UNAUTHORIZED_CHANGE_DETECTED has no single obvious
# department - LAND_RECORDS is the closest owner (title/boundary records).
_ALERT_TYPE_DEPARTMENT = {
    "RESTRICTION_ZONE_OVERLAP": "RESTRICTION",
    "RESTRICTION_DETECTED": "RESTRICTION",
    "TAX_OVERDUE": "TAX",
    "DISPUTE_DETECTED": "DISPUTE",
    "UNAUTHORIZED_CHANGE_DETECTED": "LAND_RECORDS",
}


def alert_department_for(alert_type: str) -> str | None:
    return _ALERT_TYPE_DEPARTMENT.get(alert_type)


class InvalidTransitionError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def find_all(db: Session, status: str | None = None, severity: str | None = None) -> list[GovernanceAlert]:
    stmt = select(GovernanceAlert)
    # ACTIVE is a pseudo-status, not a real column value - "still needs
    # attention" now spans 3 real statuses (OPEN/ACKNOWLEDGED/FIELD_VERIFIED).
    if status == "ACTIVE":
        stmt = stmt.where(GovernanceAlert.status.not_in(CLOSED_ALERT_STATUSES))
    elif status:
        stmt = stmt.where(GovernanceAlert.status == status)
    if severity:
        stmt = stmt.where(GovernanceAlert.severity == severity)
    stmt = stmt.order_by(GovernanceAlert.created_at.desc())
    return list(db.scalars(stmt).all())


def find_one(db: Session, alert_id: str) -> GovernanceAlert | None:
    return db.get(GovernanceAlert, alert_id)


def update_status(db: Session, alert_id: str, new_status: str, reason: str) -> GovernanceAlert | None:
    alert = db.get(GovernanceAlert, alert_id)
    if alert is None:
        return None

    reachable = VALID_TRANSITIONS.get(alert.status, [])
    if new_status not in reachable:
        if reachable:
            raise InvalidTransitionError(
                f'Cannot move a "{alert.status}" alert directly to "{new_status}" - the next stage(s) from here are: {", ".join(reachable)}.'
            )
        raise InvalidTransitionError(f'This alert is already "{alert.status}" and can\'t be moved to another stage.')

    alert.status = new_status
    alert.reason = reason
    db.flush()

    # Only notify on final closure (RESOLVED/DISMISSED), not on every
    # intermediate stage - ACKNOWLEDGED/FIELD_VERIFIED would otherwise spam
    # the department for progress that isn't a decision yet.
    if new_status in ("RESOLVED", "DISMISSED"):
        _notify_department_of_review(db, alert)

    return alert


def _notify_department_of_review(db: Session, alert: GovernanceAlert) -> None:
    department = alert_department_for(alert.alert_type)
    role = DEPARTMENT_ROLE.get(department) if department else None
    if not role:
        return

    officers = list(db.scalars(select(User).where(User.role == role)).all())
    if not officers:
        return

    verb = "dismissed" if alert.status == "DISMISSED" else "resolved"
    notification_feed_service.notify_users(
        db,
        [str(officer.id) for officer in officers],
        NotificationPayload(
            type="GOVERNANCE_ALERT_DISMISSED" if alert.status == "DISMISSED" else "GOVERNANCE_ALERT_RESOLVED",
            title=f"A {department} alert was {verb}",
            # reason is mandatory (UpdateGovernanceAlertStatus), so it's
            # always real text here - no fallback needed.
            message=f"{alert.alert_type.replace('_', ' ')} was {verb}. {alert.reason}",
            parcel_id=alert.parcel_id,
            alert_id=str(alert.id),
        ),
    )
