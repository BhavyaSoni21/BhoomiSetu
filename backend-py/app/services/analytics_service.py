"""Ported from backend/src/analytics/analytics.service.ts.

Closes the "analytics-driven governance insights" gap named in the SIH
problem statement's required-solution text - platform-wide aggregates
across every department/workflow/alert table, distinct from the
per-alert AI explanation AiModule already built. Real SQL-level GROUP BY
aggregation, not a full table scan aggregated in Python.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.roles import ALL_STAFF_ROLES, OFFICER_ROLES, ROLE_DEPARTMENT
from app.models.audit import AuditLog
from app.models.case import Case, DepartmentTask
from app.models.department_record import DisputeRecord, PlanningRecord, RegistrationRecord, TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from app.models.user import User
from app.models.workflow import Workflow, WorkflowStep
from app.services.governance_alerts_service import CLOSED_ALERT_STATUSES


@dataclass
class Distribution:
    key: str
    count: int


@dataclass
class AnalyticsTotals:
    parcels: int
    workflows: int
    cases: int
    open_cases: int
    open_alerts: int
    active_disputes: int
    total_users: int
    recent_logins_24h: int


@dataclass
class AnalyticsSummary:
    totals: AnalyticsTotals
    tax_status_distribution: list[Distribution]
    registration_status_distribution: list[Distribution]
    land_use_distribution: list[Distribution]
    dispute_case_status_distribution: list[Distribution]
    workflow_status_distribution: list[Distribution]
    workflow_type_distribution: list[Distribution]
    # Case model (newer citizen-facing pipeline) alongside legacy Workflow.
    case_status_distribution: list[Distribution]
    case_intent_distribution: list[Distribution]
    case_priority_distribution: list[Distribution]
    department_task_status_distribution: list[Distribution]
    alert_severity_distribution: list[Distribution]
    alert_status_distribution: list[Distribution]


@dataclass
class OfficerMonitoringEntry:
    user_id: str
    name: str
    role: str
    department: str
    # WorkflowStep has no per-user assignee column, only assigned_role (a
    # role, shared by every officer holding it) - this is a real count,
    # just role-level rather than personal. Two officers sharing a role
    # will show the same number here.
    pending_in_role_queue: int
    approved_count: int
    rejected_count: int
    avg_decision_hours: float | None
    last_activity_at: datetime | None


def _group_count(db: Session, column) -> list[Distribution]:
    rows = db.execute(select(column, func.count()).where(column.is_not(None)).group_by(column)).all()
    return [Distribution(key=key, count=count) for key, count in rows]


def get_summary(db: Session) -> AnalyticsSummary:
    one_day_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)

    parcel_count = db.scalar(select(func.count()).select_from(Parcel))
    workflow_count = db.scalar(select(func.count()).select_from(Workflow))
    case_count = db.scalar(select(func.count()).select_from(Case))
    # A case still "in the pipeline" - everything except CLOSED.
    open_case_count = db.scalar(select(func.count()).select_from(Case).where(Case.status != "CLOSED"))
    # "Open Alerts" means "still needs attention" - that's 3 real statuses
    # (OPEN/ACKNOWLEDGED/FIELD_VERIFIED), not just the literal OPEN one.
    open_alert_count = db.scalar(select(func.count()).select_from(GovernanceAlert).where(GovernanceAlert.status.not_in(CLOSED_ALERT_STATUSES)))
    active_dispute_count = db.scalar(select(func.count()).select_from(DisputeRecord).where(DisputeRecord.has_active_dispute.is_(True)))
    # Staff only - matches UsersService.find_all's scoping, so this "Total
    # Users" metric keeps meaning "how many officer/admin accounts exist"
    # now that citizen sign-in accounts also live in this table.
    total_users = db.scalar(select(func.count()).select_from(User).where(User.role.in_(ALL_STAFF_ROLES)))
    recent_logins_24h = db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action == "AUTH_LOGIN", AuditLog.created_at > one_day_ago))

    return AnalyticsSummary(
        totals=AnalyticsTotals(
            parcels=parcel_count, workflows=workflow_count, cases=case_count, open_cases=open_case_count,
            open_alerts=open_alert_count, active_disputes=active_dispute_count,
            total_users=total_users, recent_logins_24h=recent_logins_24h,
        ),
        tax_status_distribution=_group_count(db, TaxRecord.tax_status),
        registration_status_distribution=_group_count(db, RegistrationRecord.registration_status),
        land_use_distribution=_group_count(db, PlanningRecord.land_use),
        dispute_case_status_distribution=_group_count(db, DisputeRecord.case_status),
        workflow_status_distribution=_group_count(db, Workflow.current_status),
        workflow_type_distribution=_group_count(db, Workflow.workflow_type),
        case_status_distribution=_group_count(db, Case.status),
        case_intent_distribution=_group_count(db, Case.intent),
        case_priority_distribution=_group_count(db, Case.priority),
        department_task_status_distribution=_group_count(db, DepartmentTask.status),
        alert_severity_distribution=_group_count(db, GovernanceAlert.severity),
        alert_status_distribution=_group_count(db, GovernanceAlert.status),
    )


# "Officer monitoring - how officers handle citizen issues." Built
# entirely from data that already exists, no new logging: pending
# workload comes from a real SQL GROUP BY over WorkflowStep; who
# personally approved/rejected what comes from AuditLog, the only place
# an INDIVIDUAL officer (not just a role) is ever attributable to a
# decision - WorkflowStep itself only stores assigned_role.
# AuditLog.metadata_json is a serialized JSON *text* column (not portably
# query-able), so the "time from request submission to this decision"
# correlation against Workflow.created_at happens in Python after
# fetching, not via a SQL join - same small-dataset convention this
# codebase already uses elsewhere.
def get_officer_monitoring(db: Session) -> list[OfficerMonitoringEntry]:
    officers = list(db.scalars(select(User).where(User.role.in_(OFFICER_ROLES)).order_by(User.name.asc())).all())

    pending_by_role: dict[str, int] = dict(
        db.execute(select(WorkflowStep.assigned_role, func.count()).where(WorkflowStep.status == "PENDING").group_by(WorkflowStep.assigned_role)).all()
    )

    decision_logs = list(db.scalars(select(AuditLog).where(AuditLog.action.in_(["WORKFLOW_STEP_APPROVED", "WORKFLOW_STEP_REJECTED"]))).all())
    # id + created_at only - this mock never has more than a few hundred
    # workflows, so an id->created_at map fits comfortably in memory.
    workflow_created_at_by_id = {str(w_id): created_at for w_id, created_at in db.execute(select(Workflow.id, Workflow.created_at)).all()}

    @dataclass
    class _Agg:
        approved_count: int = 0
        rejected_count: int = 0
        total_decision_hours: float = 0.0
        decided_with_known_workflow_count: int = 0
        last_activity_at: datetime = field(default_factory=lambda: datetime.min)

    by_user_id: dict[str, _Agg] = {}
    for log in decision_logs:
        agg = by_user_id.setdefault(log.user_id, _Agg(last_activity_at=log.created_at))
        if log.action == "WORKFLOW_STEP_APPROVED":
            agg.approved_count += 1
        else:
            agg.rejected_count += 1
        if log.created_at > agg.last_activity_at:
            agg.last_activity_at = log.created_at

        metadata = json.loads(log.metadata_json) if log.metadata_json else None
        workflow_id = metadata.get("workflowId") if metadata else None
        workflow_created_at = workflow_created_at_by_id.get(workflow_id) if workflow_id else None
        if workflow_created_at:
            agg.total_decision_hours += (log.created_at - workflow_created_at).total_seconds() / 3600
            agg.decided_with_known_workflow_count += 1

    entries = []
    for officer in officers:
        agg = by_user_id.get(str(officer.id))
        entries.append(
            OfficerMonitoringEntry(
                user_id=str(officer.id), name=officer.name, role=officer.role,
                department=ROLE_DEPARTMENT.get(officer.role, officer.role),
                pending_in_role_queue=pending_by_role.get(officer.role, 0),
                approved_count=agg.approved_count if agg else 0,
                rejected_count=agg.rejected_count if agg else 0,
                avg_decision_hours=round(agg.total_decision_hours / agg.decided_with_known_workflow_count, 1) if agg and agg.decided_with_known_workflow_count > 0 else None,
                last_activity_at=agg.last_activity_at if agg else None,
            )
        )
    return entries
