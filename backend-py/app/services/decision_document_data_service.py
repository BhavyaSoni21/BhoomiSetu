"""Data-mapping layer for Officer Decision Order and Verification Report PDFs (§49).

Gathers all case, task, decision, and evidence data into structured
dataclasses that the PDF generator consumes without querying the database.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.case import (
    AIAnalysis,
    Application,
    Case,
    CaseTimelineEvent,
    DepartmentTask,
    RoutingDecision,
)
from app.models.parcel import Parcel
from app.models.user import User
from app.services.case_service import get_case, get_tasks_for_case, get_ai_analysis, get_routing_decision


@dataclass
class TaskDecisionData:
    """Per-department task resolution data for the decision document."""
    department_code: str
    department_name: str | None
    status: str
    resolution_mode: str | None
    resolution_decision: str | None
    resolution_remarks: str | None
    assigned_officer_id: str | None
    stage_name: str | None
    completed_at: datetime | None


@dataclass
class EvidenceSummary:
    """Summary of field verification evidence for the verification report."""
    photo_count: int
    gps_captured: bool
    notes: str | None
    captured_at: datetime | None


@dataclass
class DecisionDocumentData:
    """Complete data tree for rendering decision documents (§49)."""
    case_no: str
    case_id: str
    parcel_id: str
    citizen_id: str
    citizen_name: str | None
    citizen_contact: str | None
    citizen_address: str | None
    intent: str | None
    status: str
    priority: str | None
    created_at: datetime
    resolved_at: datetime | None
    parcel_survey_no: str | None
    parcel_area: str | None
    parcel_ulpin: str | None
    application_draft: str | None
    ai_structured_understanding: dict | None
    routing_decision: dict | None
    departments_routed: list[dict] | None
    tasks: list[TaskDecisionData] = field(default_factory=list)
    timeline_events: list[dict] = field(default_factory=list)
    evidence: EvidenceSummary | None = None
    officer_name: str | None = None
    officer_role: str | None = None
    decision: str | None = None
    decision_reason: str | None = None
    document_date: datetime | None = None


def build_decision_document_data(
    db: Session,
    case_id: str,
    officer_id: str | None = None,
    decision: str | None = None,
    decision_reason: str | None = None,
) -> DecisionDocumentData | str:
    """Gather all data needed for Officer Decision Order and Verification Report PDFs (§49).

    Returns a DecisionDocumentData dataclass, or CASE_NOT_FOUND string.
    """
    from app.services.case_service import CASE_NOT_FOUND
    from app.models.admin import Department

    case = get_case(db, case_id)
    if isinstance(case, str):
        return CASE_NOT_FOUND

    tasks = get_tasks_for_case(db, case_id)
    ai_analysis = get_ai_analysis(db, case_id)
    routing = get_routing_decision(db, case_id)

    parcel = db.get(Parcel, case.parcel_id) if case.parcel_id else None

    citizen: User | None = None
    if case.citizen_id:
        citizen = db.get(User, case.citizen_id)

    officer: User | None = None
    if officer_id:
        officer = db.get(User, officer_id)

    application_record = db.query(Application).filter_by(case_id=case.id).first()
    timeline = db.query(CaseTimelineEvent).filter_by(case_id=case.id).order_by(CaseTimelineEvent.created_at.asc()).all()

    # NOTE: VerificationEvidence is currently linked to Workflow (old model),
    # not Case. Evidence tied to department tasks via CaseTimelineEvent/
    # DepartmentTask will be gathered here once the task-level evidence model
    # is extended (Phase 5 integration).
    evidence_summary: EvidenceSummary | None = None

    task_data: list[TaskDecisionData] = []
    for task in tasks:
        dept: Department | None = None
        if task.department_id:
            dept = db.get(Department, str(task.department_id))
            if dept is None:
                dept = db.query(Department).filter_by(code=str(task.department_id)).first()
        task_data.append(TaskDecisionData(
            department_code=dept.code if dept else str(task.department_id),
            department_name=dept.name if dept else None,
            status=task.status,
            resolution_mode=task.resolution_mode,
            resolution_decision=task.resolution_decision,
            resolution_remarks=task.resolution_remarks,
            assigned_officer_id=task.assigned_officer_id,
            stage_name=task.stage_name,
            completed_at=task.completed_at,
        ))

    timeline_data = [
        {
            "event_type": e.event_type,
            "actor_id": e.actor_id,
            "actor_role": e.actor_role,
            "previous_state": e.previous_state,
            "new_state": e.new_state,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "metadata": e.event_metadata,
        }
        for e in timeline
    ]

    return DecisionDocumentData(
        case_no=case.case_no,
        case_id=str(case.id),
        parcel_id=case.parcel_id,
        citizen_id=case.citizen_id,
        citizen_name=citizen.name if citizen else None,
        citizen_contact=citizen.mobile_number if citizen else None,
        citizen_address=citizen.address if citizen else None,
        intent=case.intent,
        status=case.status,
        priority=case.priority,
        created_at=case.created_at,
        resolved_at=case.resolved_at,
        parcel_survey_no=parcel.survey_no if parcel else None,
        parcel_area=f"{parcel.area_sq_m} sqm" if parcel and parcel.area_sq_m else None,
        parcel_ulpin=parcel.ulpin if parcel else None,
        application_draft=application_record.final_submitted_version if application_record else None,
        ai_structured_understanding=ai_analysis.structured_understanding if ai_analysis else None,
        routing_decision=case.routing_decision,
        departments_routed=routing.departments_routed if routing else None,
        tasks=task_data,
        timeline_events=timeline_data,
        evidence=evidence_summary,
        officer_name=officer.name if officer else None,
        officer_role=officer.role if officer else None,
        decision=decision or (tasks[0].resolution_decision if tasks else None),
        decision_reason=decision_reason,
        document_date=datetime.utcnow(),
    )
