"""Case engine service — case creation, lifecycle, queries (§6, §59).

One active case per citizen + parcel (Invariant 1) is enforced here,
not at the router layer. Status lifecycle:
CREATED → ACTIVE → RESOLUTION → FEEDBACK → CLOSED.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.roles import CITIZEN_ROLE, ROLE_DEPARTMENT, VERIFIER_ROLE
from app.models.case import (
    AIAnalysis,
    Application,
    Case,
    CaseTimelineEvent,
    DepartmentTask,
    Feedback,
    ProposedFieldChange,
    RoutingDecision,
    SLAConfig,
    Appointment,
)
from app.models.user import User
from app.models.verification_evidence import VerificationEvidence
from app.services import audit_service, parcels_service

CASE_STATUSES = ["CREATED", "ACTIVE", "RESOLUTION", "FEEDBACK", "CLOSED"]

CASE_STATUS_TRANSITIONS = {
    "CREATED": {"ACTIVE"},
    "ACTIVE": {"RESOLUTION", "CLOSED"},
    "RESOLUTION": {"FEEDBACK", "CLOSED"},
    "FEEDBACK": {"CLOSED"},
    "CLOSED": set(),
}

CASE_TIMELINE_EVENT_TYPES = {
    "CASE_CREATED",
    "APPLICATION_GENERATED",
    "APPLICATION_CONFIRMED",
    "ROUTED_TO_DEPARTMENT",
    "OFFICER_ASSIGNED",
    "VERIFIER_ASSIGNED",
    "FIELD_VISIT_STARTED",
    "GPS_CAPTURED",
    "PHOTO_CAPTURED",
    "VERIFICATION_SUBMITTED",
    "OFFICER_REVIEW_STARTED",
    "APPOINTMENT_CREATED",
    "APPOINTMENT_COMPLETED",
    "DATABASE_UPDATED",
    "DECISION_APPROVED",
    "DECISION_REJECTED",
    "CASE_CLOSED",
    "FEEDBACK_SUBMITTED",
}

CASE_NOT_FOUND = "CASE_NOT_FOUND"
ACTIVE_CASE_EXISTS = "ACTIVE_CASE_EXISTS"
INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION"
PARCEL_NOT_FOUND = "PARCEL_NOT_FOUND"

TASK_NOT_FOUND = "TASK_NOT_FOUND"
INVALID_TASK_TRANSITION = "INVALID_TASK_TRANSITION"
TASK_ALREADY_ASSIGNED = "TASK_ALREADY_ASSIGNED"
INVALID_DECISION_ACTION = "INVALID_DECISION_ACTION"

PROPOSAL_NOT_FOUND = "PROPOSAL_NOT_FOUND"
PROPOSAL_ALREADY_RESOLVED = "PROPOSAL_ALREADY_RESOLVED"
PROPOSAL_NOT_PENDING = "PROPOSAL_NOT_PENDING"

FIELD_CHANGE_APPROVED = "FIELD_CHANGE_APPROVED"
FORBIDDEN = "FORBIDDEN"
VERIFY_TASK_NOT_ASSIGNABLE = "VERIFY_TASK_NOT_ASSIGNABLE"


DEPARTMENT_TASK_STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"]


TASK_STATUS_TRANSITIONS = {
    "PENDING": {"ASSIGNED", "IN_PROGRESS", "BLOCKED", "CANCELLED"},
    "ASSIGNED": {"IN_PROGRESS", "BLOCKED", "CANCELLED"},
    "IN_PROGRESS": {"COMPLETED", "BLOCKED", "CANCELLED"},
    "BLOCKED": {"IN_PROGRESS", "CANCELLED"},
    "COMPLETED": {"CANCELLED"},
    "CANCELLED": set(),
}


TASK_DECISION_ACTIONS = ["APPROVE", "REJECT", "RETURN_FOR_REVIEW"]

RESOLUTION_MODES = ["DIGITAL", "FIELD_VERIFICATION", "OFFLINE_APPOINTMENT", "HYBRID", "MANUAL_REVIEW"]

# Maps department code to default resolution mode (§36).
# Departments that can correct records digitally: LAND_RECORDS, REGISTRATION, TAX
# Departments requiring field verification: SURVEY
# Departments requiring appointments: DISPUTE, PLANNING
# All others default to MANUAL_REVIEW.
DEFAULT_DEPARTMENT_RESOLUTION_MODES = {
    "LAND_RECORDS": "DIGITAL",
    "REGISTRATION": "DIGITAL",
    "TAX": "DIGITAL",
    "SURVEY": "FIELD_VERIFICATION",
    "DISPUTE": "OFFLINE_APPOINTMENT",
    "PLANNING": "OFFLINE_APPOINTMENT",
    "RESTRICTION": "MANUAL_REVIEW",
    "ENCUMBRANCE": "MANUAL_REVIEW",
}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _can_manage_case(user: User, case: Case, db: Session) -> bool:
    """Citizens can only manage cases on parcels they're associated with.
    ADMIN can manage any case. A department officer can manage a case only
    when it has a task in their own department - jurisdiction scoping that
    mirrors _can_manage_task, rather than every staff role managing every
    case."""
    if user.role == "ADMIN":
        return True
    if user.role in ROLE_DEPARTMENT:
        from app.models.admin import Department
        user_dept_code = ROLE_DEPARTMENT[user.role]
        dept_ids = db.query(Department.id).filter(Department.code == user_dept_code)
        return db.query(DepartmentTask.id).filter(
            DepartmentTask.case_id == str(case.id),
            DepartmentTask.department_id.in_(dept_ids),
        ).first() is not None
    if user.role == CITIZEN_ROLE:
        return case.citizen_id == str(user.id) or parcels_service.is_citizen_associated_with_parcel(db, str(user.id), case.parcel_id)
    return False


def _can_view_case(user: User, case: Case, db: Session) -> bool:
    """Read access is broader than manage: a verifier who is assigned to any
    task in the case may read it (and its package) for the field visit,
    without gaining the manage rights that _can_manage_case grants staff."""
    if _can_manage_case(user, case, db):
        return True
    if user.role == VERIFIER_ROLE:
        return db.query(DepartmentTask.id).filter(
            DepartmentTask.case_id == str(case.id),
            DepartmentTask.assigned_verifier_id == str(user.id),
        ).first() is not None
    return False


def get_case(db: Session, case_id: str) -> Case | str:
    case = db.get(Case, case_id)
    if case is None:
        return CASE_NOT_FOUND
    return case


def get_case_by_number(db: Session, case_no: str) -> Case | None:
    return db.query(Case).filter_by(case_no=case_no).first()


def create_case(
    db: Session,
    *,
    citizen_id: str,
    parcel_id: str,
    intent: str | None = None,
    priority: str | None = None,
    user: User | None = None,
) -> Case | str:
    """Create a new case for a citizen + parcel.

    Enforces Invariant 1: no duplicate active cases for same
    citizen + parcel. Verifies parcel exists and citizen has access.
    """
    # Verify parcel exists
    if parcels_service.find_one(db, parcel_id) is None:
        return PARCEL_NOT_FOUND

    # Verify citizen has access to this parcel (§7)
    if user and user.role == CITIZEN_ROLE:
        if not parcels_service.is_citizen_associated_with_parcel(db, citizen_id, parcel_id):
            return PARCEL_NOT_FOUND

    # Check for existing active case (Invariant 1)
    existing_active = (
        db.query(Case)
        .filter(
            Case.citizen_id == citizen_id,
            Case.parcel_id == parcel_id,
            Case.status.in_(["CREATED", "ACTIVE", "RESOLUTION", "FEEDBACK"]),
        )
        .first()
    )
    if existing_active:
        return ACTIVE_CASE_EXISTS

    case_no = _generate_case_no(db)
    case = Case(
        case_no=case_no,
        citizen_id=citizen_id,
        parcel_id=parcel_id,
        intent=intent,
        status="CREATED",
        priority=priority,
    )
    db.add(case)
    try:
        db.flush()
    except IntegrityError:
        # Another request created the active case between our read above and
        # this INSERT; the partial unique index caught it (SEC-03). Roll back
        # the failed INSERT (the only write staged so far) and report it
        # exactly as the read-check would have.
        db.rollback()
        return ACTIVE_CASE_EXISTS

    audit_service.log(
        db,
        user_id=str(user.id) if user else citizen_id,
        user_role=user.role if user else "CITIZEN",
        action="CASE_CREATED",
        entity_type="CASE",
        entity_id=str(case.id),
        case_id=str(case.id),
        parcel_id=parcel_id,
        metadata={"caseNo": case_no, "intent": intent, "priority": priority},
    )

    _add_timeline_event(
        db,
        case,
        "CASE_CREATED",
        actor_id=str(user.id) if user else citizen_id,
        actor_role=user.role if user else "CITIZEN",
        previous_state=None,
        new_state="CREATED",
    )

    return case


def update_case_status(
    db: Session, case_id: str, new_status: str, user: User, remarks: str | None = None
) -> Case | str:
    """Transition a case through its lifecycle.

    Validates the transition is legal per the state machine.
    """
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    if not _can_manage_case(user, case, db):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    if new_status not in CASE_STATUSES:
        return INVALID_STATUS_TRANSITION

    allowed = CASE_STATUS_TRANSITIONS.get(case.status, set())
    if new_status not in allowed:
        return INVALID_STATUS_TRANSITION

    previous_status = case.status
    case.status = new_status

    if new_status == "CLOSED":
        case.closed_at = _now()
    if new_status == "RESOLUTION":
        case.resolved_at = _now()

    db.flush()

    audit_service.log(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="CASE_STATUS_CHANGED",
        entity_type="CASE",
        entity_id=str(case.id),
        case_id=str(case.id),
        parcel_id=case.parcel_id,
        previous_value={"status": previous_status},
        new_value={"status": new_status},
        reason=remarks,
        metadata={
            "previousStatus": previous_status,
            "newStatus": new_status,
            "remarks": remarks,
        },
    )

    _add_timeline_event(
        db,
        case,
        f"CASE_{new_status}",
        actor_id=str(user.id),
        actor_role=user.role,
        previous_state=previous_status,
        new_state=new_status,
    )

    return case


def get_cases_by_citizen(db: Session, citizen_id: str) -> list[Case]:
    return list(db.query(Case).filter_by(citizen_id=citizen_id).order_by(Case.created_at.desc()).all())


def get_cases_by_parcel(db: Session, parcel_id: str) -> list[Case]:
    return list(db.query(Case).filter_by(parcel_id=parcel_id).order_by(Case.created_at.desc()).all())


def get_active_case_for_parcel(db: Session, parcel_id: str) -> Case | None:
    return (
        db.query(Case)
        .filter(
            Case.parcel_id == parcel_id,
            Case.status.in_(["CREATED", "ACTIVE", "RESOLUTION", "FEEDBACK"]),
        )
        .first()
    )


def get_cases_by_officer(db: Session, officer_id: str) -> list[Case]:
    """Cases where the officer is assigned to a department task."""
    return (
        db.query(Case)
        .join(DepartmentTask, DepartmentTask.case_id == Case.id)
        .filter(DepartmentTask.assigned_officer_id == officer_id)
        .order_by(Case.created_at.desc())
        .all()
    )


def get_cases_by_department(db: Session, department_id: str) -> list[Case]:
    """Cases involving a specific department."""
    return (
        db.query(Case)
        .join(DepartmentTask, DepartmentTask.case_id == Case.id)
        .filter(DepartmentTask.department_id == department_id)
        .order_by(Case.created_at.desc())
        .all()
    )


def determine_resolution_mode(db: Session, department_id: str, workflow_id: str | None = None) -> str:
    """Determine the resolution mode for a department task (§36).

    Uses the department code and optionally the workflow to decide whether
    the task can be resolved DIGITAL, requires FIELD_VERIFICATION, OFFLINE_APPOINTMENT,
    HYBRID, or defaults to MANUAL_REVIEW.
    """
    dept_code = _resolve_department_code(db, department_id)
    mode = DEFAULT_DEPARTMENT_RESOLUTION_MODES.get(dept_code, "MANUAL_REVIEW")
    return mode


def add_department_task(
    db: Session,
    case_id: str,
    department_id: str,
    workflow_id: str | None = None,
    stage_name: str | None = None,
) -> DepartmentTask | str:
    """Add a department task to a case (§18)."""
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    task = DepartmentTask(
        case_id=case_id,
        department_id=department_id,
        workflow_id=workflow_id,
        stage_name=stage_name,
        status="PENDING",
        resolution_mode=determine_resolution_mode(db, department_id, workflow_id),
    )
    db.add(task)
    db.flush()

    _add_timeline_event(
        db,
        case,
        "ROUTED_TO_DEPARTMENT",
        actor_id=case.citizen_id,
        actor_role="CITIZEN",
        previous_state=case.status,
        new_state=case.status,
        metadata={"departmentId": department_id, "workflowId": workflow_id},
    )

    return task


def get_tasks_for_case(db: Session, case_id: str) -> list[DepartmentTask]:
    case = get_case(db, case_id)
    if isinstance(case, str):
        return []
    return case.tasks


def get_tasks_for_officer(db: Session, officer_id: str, skip: int = 0, limit: int = 20) -> list[DepartmentTask]:
    """Tasks assigned to a specific officer (A 59)."""
    return (
        db.query(DepartmentTask)
        .filter(DepartmentTask.assigned_officer_id == officer_id)
        .order_by(DepartmentTask.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_ai_analysis(
    db: Session,
    case_id: str,
    structured_understanding: dict | None = None,
    facts_stated: list[dict] | None = None,
    facts_verified: list[dict] | None = None,
    departments_identified: list[dict] | None = None,
    application_draft: str | None = None,
    follow_up_questions: list[str] | None = None,
    conversation: list[dict] | None = None,
) -> AIAnalysis | str:
    """Create an AI analysis for a case (§11)."""
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    analysis = AIAnalysis(
        case_id=case_id,
        structured_understanding=structured_understanding,
        facts_stated=facts_stated,
        facts_verified=facts_verified,
        departments_identified=departments_identified,
        application_draft=application_draft,
        follow_up_questions=follow_up_questions,
        conversation=conversation,
    )
    db.add(analysis)
    db.flush()
    return analysis


def create_routing_decision(
    db: Session,
    case_id: str,
    departments_routed: list[dict] | None = None,
    workflow_per_department: dict | None = None,
    priority: str | None = None,
) -> RoutingDecision | str:
    """Create a routing decision for a case (§17)."""
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    decision = RoutingDecision(
        case_id=case_id,
        departments_routed=departments_routed,
        workflow_per_department=workflow_per_department,
        priority=priority,
    )
    db.add(decision)
    db.flush()

    # Update case with routing info
    case.routing_decision = {
        "departments_routed": departments_routed,
        "workflow_per_department": workflow_per_department,
        "priority": priority,
    }
    db.flush()

    return decision


def create_appointment(
    db: Session,
    case_id: str,
    citizen_id: str,
    department_id: str,
    officer_id: str | None = None,
    office_location: str | None = None,
    date: datetime | None = None,
    time_slot: str | None = None,
    purpose: str | None = None,
    required_documents: list[str] | None = None,
) -> Appointment | str:
    """Create an appointment linked to a case (§45, §46)."""
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    # If department_id is not a valid UUID (e.g. it's a code like "DISPUTE"), look it up
    try:
        import uuid
        uuid.UUID(department_id)
        final_dept_id = department_id
    except ValueError:
        from app.models.admin import Department
        dept = db.query(Department).filter(Department.code == department_id).first()
        if not dept:
            return "Department not found"
        final_dept_id = str(dept.id)

    appointment = Appointment(
        case_id=case_id,
        citizen_id=citizen_id,
        department_id=final_dept_id,
        officer_id=officer_id,
        office_location=office_location,
        date=date or _now(),
        time_slot=time_slot,
        purpose=purpose,
        required_documents=required_documents,
        status="REQUESTED",
    )
    db.add(appointment)
    db.flush()

    _add_timeline_event(
        db,
        case,
        "APPOINTMENT_CREATED",
        actor_id=citizen_id,
        actor_role="CITIZEN",
        previous_state=case.status,
        new_state=case.status,
        metadata={"appointmentId": str(appointment.id), "departmentId": department_id},
    )

    return appointment


APPOINTMENT_STATUSES = ["REQUESTED", "CONFIRMED", "RESCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]


def get_appointments(db: Session, case_id: str) -> list[Appointment]:
    """List all appointments for a case (§46)."""
    return db.query(Appointment).filter(Appointment.case_id == case_id).order_by(Appointment.created_at.desc()).all()


def get_appointment(db: Session, appointment_id: str) -> Appointment | None:
    """Retrieve a single appointment by id (§46)."""
    return db.query(Appointment).filter(Appointment.id == appointment_id).first()


def update_appointment(
    db: Session,
    appointment_id: str,
    officer_id: str | None = None,
    office_location: str | None = None,
    date: datetime | None = None,
    time_slot: str | None = None,
    purpose: str | None = None,
    required_documents: list[str] | None = None,
    status: str | None = None,
    remarks: str | None = None,
) -> Appointment:
    """Update an appointment's fields and optionally transition its status (§46).

    Returns the updated Appointment. The caller must be authorized to manage the
    case; use ``_can_manage_case`` in the router before calling.
    """
    appointment = get_appointment(db, appointment_id)
    if appointment is None:
        raise ValueError(f"Appointment not found: {appointment_id}")

    if officer_id is not None:
        appointment.officer_id = officer_id
    if office_location is not None:
        appointment.office_location = office_location
    if date is not None:
        appointment.date = date
    if time_slot is not None:
        appointment.time_slot = time_slot
    if purpose is not None:
        appointment.purpose = purpose
    if required_documents is not None:
        appointment.required_documents = required_documents
    if remarks is not None:
        appointment.remarks = remarks

    if status is not None:
        if status not in APPOINTMENT_STATUSES:
            raise ValueError(f"Invalid appointment status: {status}")
        appointment.status = status
        if status in ("COMPLETED",):
            appointment.completed_at = _now()

    db.flush()
    return appointment


def add_timeline_event(
    db: Session,
    case_id: str,
    event_type: str,
    actor_id: str | None = None,
    actor_role: str | None = None,
    previous_state: str | None = None,
    new_state: str | None = None,
    metadata: dict | None = None,
    task_id: str | None = None,
) -> CaseTimelineEvent | str:
    """Add a timeline event to a case (§57)."""
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    if event_type not in CASE_TIMELINE_EVENT_TYPES:
        event_type = "CASE_CREATED"

    event = CaseTimelineEvent(
        case_id=case_id,
        task_id=task_id,
        event_type=event_type,
        actor_id=actor_id,
        actor_role=actor_role,
        previous_state=previous_state,
        new_state=new_state,
        event_metadata=metadata,
    )
    db.add(event)
    db.flush()
    return event


def _add_timeline_event(
    db: Session,
    case: Case,
    event_type: str,
    actor_id: str | None = None,
    actor_role: str | None = None,
    previous_state: str | None = None,
    new_state: str | None = None,
    metadata: dict | None = None,
) -> CaseTimelineEvent:
    """Internal: add timeline event from a Case object."""
    event = CaseTimelineEvent(
        case_id=case.id,
        event_type=event_type,
        actor_id=actor_id,
        actor_role=actor_role,
        previous_state=previous_state,
        new_state=new_state,
        event_metadata=metadata,
    )
    db.add(event)
    db.flush()
    return event


def get_timeline(db: Session, case_id: str) -> list[CaseTimelineEvent]:
    case = get_case(db, case_id)
    if isinstance(case, str):
        return []
    return (
        db.query(CaseTimelineEvent)
        .filter_by(case_id=case_id)
        .order_by(CaseTimelineEvent.created_at.asc())
        .all()
    )


def get_feedback_for_case(db: Session, case_id: str) -> list[Feedback]:
    case = get_case(db, case_id)
    if isinstance(case, str):
        return []
    return db.query(Feedback).filter_by(case_id=case_id).order_by(Feedback.created_at.desc()).all()


def submit_feedback(
    db: Session,
    case_id: str,
    citizen_id: str,
    category: str | None = None,
    officer_rating: int | None = None,
    overall_case_rating: int | None = None,
    type: str | None = None,
    comments: str | None = None,
    reasons: list[str] | None = None,
    is_anonymous: bool = False,
    officer_id: str | None = None,
    department_id: str | None = None,
    task_id: str | None = None,
) -> Feedback | str:
    """Submit citizen feedback for a case (§51, §52)."""
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    feedback = Feedback(
        case_id=case_id,
        citizen_id=citizen_id,
        officer_id=officer_id,
        department_id=department_id,
        task_id=task_id,
        category=category,
        officer_rating=officer_rating,
        overall_case_rating=overall_case_rating,
        type=type,
        comments=comments,
        reasons=reasons,
        is_anonymous=is_anonymous,
    )
    db.add(feedback)
    db.flush()

    _add_timeline_event(
        db,
        case,
        "FEEDBACK_SUBMITTED",
        actor_id=citizen_id,
        actor_role="CITIZEN",
        previous_state=case.status,
        new_state=case.status,
        metadata={"feedbackId": str(feedback.id)},
    )

    return feedback


def get_sla_config(db: Session, sla_config_id: str) -> SLAConfig | None:
    return db.get(SLAConfig, sla_config_id)


def get_active_slas_for_case(db: Session, case_id: str) -> list[SLAConfig]:
    case = get_case(db, case_id)
    if isinstance(case, str):
        return []
    return (
        db.query(SLAConfig)
        .filter(SLAConfig.is_active == True)
        .filter(
            (SLAConfig.workflow_id.in_(db.query(DepartmentTask.workflow_id).filter_by(case_id=case_id).subquery()))
            | (SLAConfig.task_id.in_(db.query(DepartmentTask.id).filter_by(case_id=case_id).subquery()))
        )
        .all()
    )


def get_ai_analysis(db: Session, case_id: str) -> AIAnalysis | None:
    return db.query(AIAnalysis).filter_by(case_id=case_id).order_by(AIAnalysis.created_at.desc()).first()


def get_routing_decision(db: Session, case_id: str) -> RoutingDecision | None:
    return db.query(RoutingDecision).filter_by(case_id=case_id).order_by(RoutingDecision.created_at.desc()).first()


def get_case_detail(db: Session, case_id: str, user: User) -> dict[str, Any] | str:
    """Full case detail with tasks, timeline, and access check."""
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    if not _can_manage_case(user, case, db):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    tasks = get_tasks_for_case(db, case_id)
    timeline = get_timeline(db, case_id)
    feedback = get_feedback_for_case(db, case_id)
    ai_analysis = get_ai_analysis(db, case_id)
    routing = get_routing_decision(db, case_id)

    return {
        "case": case,
        "tasks": tasks,
        "timeline": timeline,
        "feedback": feedback,
        "aiAnalysis": ai_analysis,
        "routingDecision": routing,
    }


# --- Phase 2: Case Creation from Confirmed Application (§9, §14, §17, §18) ----

APPLICATION_NOT_FOUND = "APPLICATION_NOT_FOUND"


def create_case_from_application(
    db: Session,
    *,
    citizen_id: str,
    parcel_id: str,
    intent: str | None = None,
    priority: str | None = None,
    application_draft: str | None = None,
    citizen_edited_version: str | None = None,
    ai_structured_understanding: dict | None = None,
    facts_database: list[str] | None = None,
    citizen_statements: list[str] | None = None,
    conversation: list[dict] | None = None,
    routing_result: dict | None = None,
    user: User | None = None,
) -> Case | str:
    """Create a case from a citizen's confirmed application (§9, §17, §18).

    Called after the citizen confirms the AI-generated application. This
    function:
    1. Creates the Case (with Invariant 1 check).
    2. Persists the AIAnalysis (structured understanding, facts, draft).
    3. Creates the Application record (with full version history, §14).
    4. Creates the RoutingDecision + DepartmentTasks per routed department (§17, §18).
    5. Transitions the case to ACTIVE.
    6. Returns the created Case.

    The routing_result dict should contain: departments (list of {department,
    confidence, reason}), workflows_per_department (dict), required_capabilities
    (list), priority (str|None), reason (str|None).
    """
    # Step 1: Create the Case (with Invariant 1 enforcement)
    case = create_case(
        db,
        citizen_id=citizen_id,
        parcel_id=parcel_id,
        intent=intent,
        priority=priority,
        user=user,
    )
    if isinstance(case, str):
        return case

    # Step 2: Persist AIAnalysis (structured understanding + facts)
    ai_analysis_record = AIAnalysis(
        case_id=case.id,
        structured_understanding=ai_structured_understanding,
        facts_stated=citizen_statements,
        facts_verified=None,
        departments_identified=ai_structured_understanding.get("departments") if ai_structured_understanding else None,
        application_draft=application_draft,
        follow_up_questions=[],
        conversation=conversation,
    )
    db.add(ai_analysis_record)
    db.flush()

    # Step 3: Create Application record (versioning per §14)
    final_submitted = citizen_edited_version or application_draft
    application = Application(
        case_id=case.id,
        original_input=conversation[0]["text"] if conversation and len(conversation) > 0 else None,
        conversation=conversation,
        ai_interpretation=ai_structured_understanding,
        ai_draft=application_draft,
        citizen_edited_version=citizen_edited_version,
        final_submitted_version=final_submitted,
        citizen_confirmed=True,
        citizen_confirmation_timestamp=_now(),
    )
    db.add(application)
    db.flush()

    # Step 4: Create RoutingDecision + DepartmentTasks
    if routing_result and routing_result.get("departments"):
        departments_routed = routing_result["departments"]
        workflow_per_department = routing_result.get("workflows_per_department")
        routing_priority = routing_result.get("priority") or priority
        routing_reason = routing_result.get("reason")

        # Normalize routing priority to case priority if not set
        if routing_priority and not case.priority:
            case.priority = routing_priority
            db.flush()

        decision = RoutingDecision(
            case_id=case.id,
            departments_routed=departments_routed,
            workflow_per_department=workflow_per_department,
            priority=routing_priority,
        )
        db.add(decision)
        db.flush()

        # Store routing decision on the case for traceability (§17)
        case.routing_decision = {
            "departments_routed": departments_routed,
            "workflow_per_department": workflow_per_department,
            "priority": routing_priority,
            "reason": routing_reason,
        }
        db.flush()

        # Create a DepartmentTask per routed department (§18)
        workflow_id_map = {k: str(v.get("id", "")) for k, v in (workflow_per_department or {}).items() if isinstance(v, dict)}
        for dept_entry in departments_routed:
            dept_code = dept_entry["department"]
            dept_id = _resolve_department_id(db, dept_code)
            _workflow_id = workflow_id_map.get(dept_code)

            task = add_department_task(
                db,
                case_id=str(case.id),
                department_id=dept_id,
                workflow_id=_workflow_id if _workflow_id else None,
                stage_name=None,
            )
            if isinstance(task, str):
                # Task creation failed (e.g., case not found) — continue;
                # the case still exists, officers can add tasks manually.
                continue

    # Step 5: Transition case to ACTIVE
    update_case_status(db, str(case.id), "ACTIVE", user or _system_user(), None)

    audit_service.log(
        db,
        user_id=str(user.id) if user else citizen_id,
        user_role=user.role if user else CITIZEN_ROLE,
        action="CASE_CONFIRMED_AND_ROUTED",
        entity_type="CASE",
        entity_id=str(case.id),
        case_id=str(case.id),
        parcel_id=parcel_id,
        previous_value={"status": "CREATED"},
        new_value={"status": "ACTIVE"},
        metadata={
            "caseNo": case.case_no,
            "intent": intent,
            "departmentCount": len(routing_result["departments"]) if routing_result and routing_result.get("departments") else 0,
        },
    )

    return case


def _resolve_department_id(db: Session, dept_code: str) -> str:
    """Resolve a department code (SURVEY, DISPUTE, etc.) to its DB id.

    Falls back to using the code string directly as the department_id if
    the department table isn't populated — callers handle the string
    gracefully.
    """
    from app.models.admin import Department
    dept = db.query(Department).filter_by(code=dept_code).first()
    if dept:
        return str(dept.id)
    return dept_code


def _resolve_department_code(db: Session, department_id: str) -> str:
    """Reverse of _resolve_department_id: resolve a department DB id (UUID)
    or code string back to the department code.

    If department_id is already a known code string, returns it as-is.
    Falls back to the input string if the department table is empty.
    """
    from app.models.admin import Department
    dept = db.get(Department, department_id)
    if dept:
        return dept.code
    return department_id


def get_task(db: Session, task_id: str) -> DepartmentTask | None:
    """Fetch a DepartmentTask by id."""
    return db.get(DepartmentTask, task_id)


def check_task_sla(db: Session, task_id: str) -> dict | None:
    """Check a department task's SLA status (§56).

    Looks up the SLA config for the task (or its workflow) and compares
    elapsed time since task creation/updates against the configured
    warning and breach thresholds.

    Returns a dict with keys: status (OK|WARNING|BREACH), task_id, elapsed_hours,
    thresholds (warning, breach), or None if no SLA config exists for the task.
    """
    task = get_task(db, task_id)
    if task is None:
        return None

    sla_configs = (
        db.query(SLAConfig)
        .filter(SLAConfig.is_active == True)
        .filter(
            (SLAConfig.task_id == task.id)
            | (SLAConfig.workflow_id == task.workflow_id)
            | (SLAConfig.department_id == task.department_id)
        )
        .all()
    )

    reference_time = task.completed_at if task.completed_at else _now()
    # Clamp: elapsed is a duration, never negative — guards inconsistent
    # timestamps (e.g. completed_at seeded before created_at).
    elapsed = max(0.0, (reference_time - task.created_at).total_seconds() / 3600.0)

    if sla_configs:
        sla = sla_configs[0]
        warning_threshold = float(sla.warning_threshold) if sla.warning_threshold else None
        breach_threshold = float(sla.breach_threshold) if sla.breach_threshold else None
    else:
        # No SLAConfig row — fall back to the thresholds carried on the task
        # itself (populated at task creation). None only if the task has none.
        warning_threshold = float(task.sla_warning_threshold) if task.sla_warning_threshold else None
        breach_threshold = float(task.sla_breach_threshold) if task.sla_breach_threshold else None
        if warning_threshold is None and breach_threshold is None:
            return None

    if breach_threshold is not None and elapsed >= breach_threshold:
        status = "BREACH"
    elif warning_threshold is not None and elapsed >= warning_threshold:
        status = "WARNING"
    else:
        status = "OK"

    return {
        "status": status,
        "task_id": str(task.id),
        "case_id": str(task.case_id),
        "elapsed_hours": round(elapsed, 2),
        "thresholds": {
            "warning": warning_threshold,
            "breach": breach_threshold,
        },
    }


def assign_task(
    db: Session,
    task_id: str,
    officer_id: str,
    user: User,
) -> DepartmentTask | str:
    """Assign an officer to a department task (§59, §60).

    Transitions task from PENDING → ASSIGNED. Only staff with the
    matching department or ADMIN may assign.
    """
    from fastapi import HTTPException, status

    task = get_task(db, task_id)
    if task is None:
        return TASK_NOT_FOUND

    if not _can_manage_task(user, task, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    if task.status != "PENDING" and task.status != "ASSIGNED":
        return INVALID_TASK_TRANSITION

    previous_status = task.status
    task.assigned_officer_id = officer_id
    task.status = "ASSIGNED"
    task.updated_at = _now()
    db.flush()

    case = get_case(db, str(task.case_id))
    _add_timeline_event(
        db,
        case if not isinstance(case, str) else None,
        "OFFICER_ASSIGNED",
        actor_id=str(user.id),
        actor_role=user.role,
        previous_state=previous_status,
        new_state="ASSIGNED",
        metadata={"taskId": task_id, "officerId": officer_id},
    )

    _notify_task_assigned(db, task, case)

    audit_service.log_case_mutation(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="TASK_ASSIGNED",
        entity_type="DEPARTMENT_TASK",
        entity_id=task_id,
        case_id=str(task.case_id),
        task_id=task_id,
        parcel_id=case.parcel_id if not isinstance(case, str) else None,
        previous_value={"status": previous_status},
        new_value={"status": "ASSIGNED", "assigned_officer_id": officer_id},
        reason=f"Task assigned to officer {officer_id}",
        metadata={"taskId": task_id, "officerId": officer_id},
    )

    return task


def advance_task(
    db: Session,
    task_id: str,
    new_status: str,
    user: User,
    stage_name: str | None = None,
    remarks: str | None = None,
) -> DepartmentTask | str:
    """Advance a department task through its workflow stage (§23, §26).

    Validates the transition is legal per TASK_STATUS_TRANSITIONS.
    If stage_name is provided, updates the task's stage_name.
    """
    from fastapi import HTTPException, status

    task = get_task(db, task_id)
    if task is None:
        return TASK_NOT_FOUND

    if not _can_manage_task(user, task, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    if new_status not in DEPARTMENT_TASK_STATUSES:
        return INVALID_TASK_TRANSITION

    allowed = TASK_STATUS_TRANSITIONS.get(task.status, set())
    if new_status not in allowed:
        return INVALID_TASK_TRANSITION

    if new_status == "COMPLETED":
        task.completed_at = _now()

    previous_status = task.status
    task.status = new_status
    if stage_name:
        task.stage_name = stage_name
    task.updated_at = _now()
    db.flush()

    if remarks:
        task.resolution_remarks = remarks

    case = get_case(db, str(task.case_id))
    event_type = f"TASK_{new_status}"
    _add_timeline_event(
        db,
        case if not isinstance(case, str) else None,
        event_type,
        actor_id=str(user.id),
        actor_role=user.role,
        previous_state=previous_status,
        new_state=new_status,
        metadata={"taskId": task_id, "stageName": stage_name, "remarks": remarks},
    )

    if new_status == "COMPLETED":
        check_case_resolution(db, str(task.case_id), user)

    _notify_task_advanced(db, task, case, previous_status, new_status, user)

    audit_service.log_case_mutation(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="TASK_ADVANCED",
        entity_type="DEPARTMENT_TASK",
        entity_id=task_id,
        case_id=str(task.case_id),
        task_id=task_id,
        parcel_id=case.parcel_id if not isinstance(case, str) else None,
        previous_value={"status": previous_status, "stage_name": task.stage_name},
        new_value={"status": new_status, "stage_name": stage_name or task.stage_name},
        reason=remarks,
        metadata={"taskId": task_id, "stageName": stage_name, "remarks": remarks},
    )

    return task


def _notify_task_advanced(db: Session, task: DepartmentTask, case: Case | str | None, previous_status: str, new_status: str, user: User) -> None:
    """Notify the assigned officer and case creator of task status changes (§50)."""
    from app.services.notification_feed_service import NotificationPayload, notify_users

    dept_code = _resolve_department_code(db, str(task.department_id)) if task.department_id else "a department"
    message = f"Task for {dept_code} department on case {case.case_no if not isinstance(case, str) else ''} has moved from {previous_status} to {new_status}."

    recipients: list[str] = []
    if task.assigned_officer_id:
        recipients.append(str(task.assigned_officer_id))
    if not isinstance(case, str) and case.citizen_id and case.citizen_id != str(user.id):
        recipients.append(case.citizen_id)

    if recipients:
        notify_users(
            db,
            recipients,
            NotificationPayload(
                type=f"TASK_{new_status}",
                title=f"Task Update — {new_status}",
                message=message,
                parcel_id=case.parcel_id if not isinstance(case, str) else None,
                case_id=str(task.case_id),
            ),
        )


def _notify_task_assigned(db: Session, task: DepartmentTask, case: Case | str) -> None:
    """Notify the assigned officer that a new task has been assigned to them (§50)."""
    from app.services.notification_feed_service import NotificationPayload, notify_users

    dept_code = _resolve_department_code(db, str(task.department_id)) if task.department_id else "a department"
    message = f"A new task has been assigned to you in the {dept_code} department for case {case.case_no if not isinstance(case, str) else ''}."

    if not task.assigned_officer_id:
        return

    notify_users(
        db,
        [str(task.assigned_officer_id)],
        NotificationPayload(
            type="TASK_ASSIGNED",
            title=f"New Task Assigned — {dept_code}",
            message=message,
            parcel_id=case.parcel_id if not isinstance(case, str) else None,
            case_id=str(task.case_id),
        ),
    )


def resolve_task(
    db: Session,
    task_id: str,
    decision: str,
    officer_id: str,
    remarks: str | None = None,
    user: User | None = None,
) -> DepartmentTask | str:
    """Apply a resolution decision to a department task (§34, §36).

    Decision is APPROVE | REJECT | RETURN_FOR_REVIEW.
    Sets resolution_decision, resolution_remarks, and transitions to COMPLETED
    (for APPROVE/REJECT) or BLOCKED (for RETURN_FOR_REVIEW).
    """
    from fastapi import HTTPException, status

    task = get_task(db, task_id)
    if task is None:
        return TASK_NOT_FOUND

    if decision not in TASK_DECISION_ACTIONS:
        return INVALID_DECISION_ACTION

    if user and not _can_manage_task(user, task, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    if task.status == "COMPLETED":
        return INVALID_TASK_TRANSITION

    previous_status = task.status
    task.resolution_decision = decision
    task.resolution_remarks = remarks
    task.assigned_officer_id = officer_id
    task.completed_at = _now()

    if decision == "RETURN_FOR_REVIEW":
        task.status = "BLOCKED"
    else:
        task.status = "COMPLETED"
    task.updated_at = _now()
    db.flush()

    case = get_case(db, str(task.case_id))
    _add_timeline_event(
        db,
        case if not isinstance(case, str) else None,
        f"DECISION_{decision}",
        actor_id=officer_id,
        actor_role=user.role if user else "STAFF",
        previous_state=previous_status,
        new_state=task.status,
        metadata={"taskId": task_id, "decision": decision, "remarks": remarks},
    )

    if task.status == "COMPLETED":
        check_case_resolution(db, str(task.case_id), user)

    _notify_task_resolved(db, task, case, decision, officer_id, user)

    audit_service.log_case_mutation(
        db,
        user_id=str(user.id) if user else officer_id,
        user_role=user.role if user else "STAFF",
        action="TASK_RESOLVED",
        entity_type="DEPARTMENT_TASK",
        entity_id=task_id,
        case_id=str(task.case_id),
        task_id=task_id,
        parcel_id=case.parcel_id if not isinstance(case, str) else None,
        previous_value={"status": previous_status, "resolution_mode": task.resolution_mode},
        new_value={"status": task.status, "resolution_decision": decision, "assigned_officer_id": officer_id},
        reason=remarks,
        metadata={"taskId": task_id, "decision": decision, "remarks": remarks},
    )

    return task


def _notify_task_resolved(db: Session, task: DepartmentTask, case: Case | str | None, decision: str, officer_id: str, user: User | None) -> None:
    """Notify the case creator (citizen) of a task resolution decision (§50)."""
    from app.services.notification_feed_service import NotificationPayload, notify_users

    if isinstance(case, str):
        return

    verb = "approved" if decision == "APPROVE" else "rejected" if decision == "REJECT" else "returned for review"
    message = f"Your case {case.case_no} has been {verb} by {officer_id} in the {case.parcel_id} department."

    notify_users(
        db,
        [case.citizen_id],
        NotificationPayload(
            type=f"TASK_RESOLVED_{decision}",
            title=f"Task {verb.capitalize()}",
            message=message,
            parcel_id=case.parcel_id,
            case_id=str(task.case_id),
        ),
    )


def check_case_resolution(db: Session, case_id: str, user: User) -> Case | None:
    """Check if all department tasks for a case are resolved (§35).

    If all tasks are COMPLETED or CANCELLED, transition case to RESOLUTION.
    Returns the updated Case or None if no transition occurred.
    """
    from fastapi import HTTPException, status

    case = get_case(db, case_id)
    if isinstance(case, str):
        return None

    if user and not _can_manage_case(user, case, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    if case.status in ("RESOLUTION", "FEEDBACK", "CLOSED"):
        return case

    tasks = get_tasks_for_case(db, case_id)
    if not tasks:
        return None

    all_done = all(t.status in ("COMPLETED", "CANCELLED") for t in tasks)
    if not all_done:
        return None

    case = update_case_status(db, case_id, "RESOLUTION", _system_user())
    if isinstance(case, str):
        return None

    _add_timeline_event(
        db,
        case if not isinstance(case, str) else None,
        "OFFICER_REVIEW_STARTED",
        actor_id="system",
        actor_role="SYSTEM",
        previous_state="ACTIVE",
        new_state="RESOLUTION",
        metadata={"caseId": case_id, "completedTaskCount": len(tasks)},
    )

    _notify_case_resolved(db, case, user)

    audit_service.log_case_mutation(
        db,
        user_id=str(user.id) if user else "system",
        user_role=user.role if user else "SYSTEM",
        action="CASE_RESOLVED",
        entity_type="CASE",
        entity_id=case_id,
        case_id=case_id,
        parcel_id=case.parcel_id,
        previous_value={"status": "ACTIVE"},
        new_value={"status": "RESOLUTION"},
        reason=f"All {len(tasks)} department tasks completed or cancelled",
        metadata={"caseId": case_id, "completedTaskCount": len(tasks)},
    )

    return case


def _notify_case_resolved(db: Session, case: Case, user: User | None) -> None:
    """Notify the case creator (citizen) that all department tasks are complete
    and the case has entered RESOLUTION (§50)."""
    from app.services.notification_feed_service import NotificationPayload, notify_users

    message = f"All department tasks for your case {case.case_no} are complete. Your case has moved to resolution review."

    notify_users(
        db,
        [case.citizen_id],
        NotificationPayload(
            type="CASE_RESOLVED",
            title="Case Ready for Resolution",
            message=message,
            parcel_id=case.parcel_id,
            case_id=str(case.id),
        ),
    )


def _can_manage_task(user: User, task: DepartmentTask, db: Session) -> bool:
    """Check if a user can manage a department task.

    ADMIN can manage any task. Department officers can manage tasks
    in their department. Citizens/verifiers cannot manage tasks.
    """
    if user.role == "ADMIN":
        return True
    if user.role in ROLE_DEPARTMENT:
        from app.models.admin import Department
        user_dept_code = ROLE_DEPARTMENT[user.role]
        dept = db.get(Department, str(task.department_id)) if task.department_id else None
        if dept:
            return dept.code == user_dept_code
        task_dept_str = str(task.department_id)
        return task_dept_str == user_dept_code
    return False


def _system_user() -> User:
    """Return a pseudo-staff user for internal operations that don't have
    an authenticated actor (e.g., automated routing)."""
    from app.models.user import User as UserModel
    u = UserModel()
    u.id = "system"
    u.role = "ADMIN"
    return u


def _generate_case_no(db: Session) -> str:
    """Generate a unique case number like BHO-2026-00182."""
    year = datetime.now().year
    prefix = "BHO"
    count = db.query(Case).filter(Case.case_no.like(f"{prefix}-{year}-%")).count()
    return f"{prefix}-{year}-{count + 1:05d}"


# --- Phase 4.4: Digital Database Updates (§37–§40) ---

# Maps department names to (model class, primary key field name) for the
# department-record tables that officers can propose changes to.
_DEPARTMENT_RECORD_MODELS = {
    "LAND_RECORDS": ("app.models.land_records", "StateALandRecord"),
    "REGISTRATION": ("app.models.department_record", "RegistrationRecord"),
    "TAX": ("app.models.department_record", "TaxRecord"),
    "RESTRICTION": ("app.models.department_record", "RestrictionRecord"),
    "DISPUTE": ("app.models.department_record", "DisputeRecord"),
    "ENCUMBRANCE": ("app.models.department_record", "EncumbranceRecord"),
    "PLANNING": ("app.models.department_record", "PlanningRecord"),
    "SURVEY": ("app.models.department_record", "SurveyRecord"),
}


def propose_field_change(
    db: Session,
    *,
    case_id: str,
    parcel_id: str,
    department: str,
    field_name: str,
    current_value: str | None,
    proposed_value: str,
    reason: str | None = None,
    proposed_by: str | None = None,
) -> ProposedFieldChange:
    """Create a proposed field change pending officer approval (§37)."""
    proposal = ProposedFieldChange(
        case_id=case_id,
        parcel_id=parcel_id,
        department=department.upper(),
        field_name=field_name,
        current_value=current_value,
        proposed_value=proposed_value,
        reason=reason,
        proposed_by=proposed_by,
        status="PENDING",
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def get_proposed_field_changes(
    db: Session,
    *,
    case_id: str,
    status: str | None = None,
) -> list[ProposedFieldChange]:
    """List proposed field changes for a case, optionally filtered by status."""
    query = db.query(ProposedFieldChange).filter_by(case_id=case_id)
    if status:
        query = query.filter(ProposedFieldChange.status == status)
    return query.order_by(ProposedFieldChange.created_at.desc()).all()


def _can_approve_proposal(user: User, db: Session, proposal: ProposedFieldChange) -> bool:
    """Verify the officer belongs to the department that the proposal targets (§38)."""
    if user.role == "ADMIN":
        return True
    if user.role in ROLE_DEPARTMENT:
        from app.models.admin import Department
        user_dept_code = ROLE_DEPARTMENT[user.role]
        dept = db.get(Department, str(proposal.department)) if proposal.department else None
        if dept:
            return dept.code == user_dept_code
        return str(proposal.department) == user_dept_code
    return False


def _get_department_record(db: Session, department: str, parcel_id: str):
    """Fetch a department-record row by department name and parcel_id."""
    mapping = _DEPARTMENT_RECORD_MODELS.get(department.upper())
    if not mapping:
        return None
    module_path, class_name = mapping
    module = __import__(module_path, fromlist=[class_name])
    model_class = getattr(module, class_name)
    return db.query(model_class).filter_by(parcel_id=parcel_id).first()


def _get_field_model(department: str):
    """Return the SQLAlchemy column-mapped class for a department, or None."""
    mapping = _DEPARTMENT_RECORD_MODELS.get(department.upper())
    if not mapping:
        return None
    module_path, class_name = mapping
    module = __import__(module_path, fromlist=[class_name])
    return getattr(module, class_name)


def approve_field_change(
    db: Session,
    *,
    proposal_id: str,
    user: User,
    remarks: str | None = None,
) -> ProposedFieldChange | str:
    """Approve a proposed field change with a transactional DB update (§37–§40).

    Flow: BEGIN → Read current → Validate Permission → Create Historical
    Version → Update Current → Audit Event → Link to Case → COMMIT.
    """
    proposal = db.get(ProposedFieldChange, proposal_id)
    if proposal is None:
        return PROPOSAL_NOT_FOUND

    if proposal.status != "PENDING":
        return PROPOSAL_NOT_PENDING

    if not _can_approve_proposal(user, db, proposal):
        return FORBIDDEN

    record = _get_department_record(db, proposal.department, proposal.parcel_id)
    if record is None:
        return PARCEL_NOT_FOUND

    ModelClass = _get_field_model(proposal.department)
    if ModelClass is None:
        return PROPOSAL_NOT_FOUND

    # Create historical version before updating (§40)
    from app.models.parcel import ParcelHistoricalState
    historical = ParcelHistoricalState(
        parcel_id=proposal.parcel_id,
        year=datetime.now().year,
        land_use=getattr(record, proposal.field_name, None),
    )
    db.add(historical)

    # Update the current record
    setattr(record, proposal.field_name, proposal.proposed_value)

    # Mark proposal as approved
    proposal.status = "APPROVED"
    proposal.decided_by = str(user.id)
    proposal.decided_at = datetime.now(timezone.utc)
    proposal.decision_remarks = remarks

    # Audit event linked to case
    audit_service.log_case_mutation(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="DATABASE_UPDATED",
        entity_type=proposal.department,
        entity_id=str(proposal.id),
        case_id=str(proposal.case_id),
        parcel_id=proposal.parcel_id,
        previous_value={"field": proposal.field_name, "value": proposal.current_value},
        new_value={"field": proposal.field_name, "value": proposal.proposed_value},
        reason=remarks or proposal.reason,
    )

    # Timeline event
    timeline_event = CaseTimelineEvent(
        case_id=proposal.case_id,
        event_type="DATABASE_UPDATED",
        actor_id=str(user.id),
        actor_role=user.role,
        previous_state=str(proposal.current_value),
        new_state=str(proposal.proposed_value),
        event_metadata={
            "field_name": proposal.field_name,
            "department": proposal.department,
            "proposal_id": str(proposal.id),
        },
    )
    db.add(timeline_event)

    db.commit()
    db.refresh(proposal)
    return proposal


def reject_field_change(
    db: Session,
    *,
    proposal_id: str,
    user: User,
    remarks: str | None = None,
) -> ProposedFieldChange | str:
    """Reject a proposed field change (§37)."""
    proposal = db.get(ProposedFieldChange, proposal_id)
    if proposal is None:
        return PROPOSAL_NOT_FOUND

    if proposal.status != "PENDING":
        return PROPOSAL_NOT_PENDING

    if not _can_approve_proposal(user, db, proposal):
        return FORBIDDEN

    proposal.status = "REJECTED"
    proposal.decided_by = str(user.id)
    proposal.decided_at = datetime.now(timezone.utc)
    proposal.decision_remarks = remarks

    audit_service.log_case_mutation(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="DECISION_REJECTED",
        entity_type="ProposedFieldChange",
        entity_id=str(proposal.id),
        case_id=str(proposal.case_id),
        parcel_id=proposal.parcel_id,
        previous_value={"field": proposal.field_name, "value": proposal.current_value},
        new_value={"field": proposal.field_name, "value": proposal.proposed_value},
        reason=remarks or proposal.reason,
    )

    db.commit()
    db.refresh(proposal)
    return proposal


def save_verification_checklist(
    db: Session,
    *,
    task_id: str,
    case_id: str,
    checklist: dict,
    remarks: str,
    user: User,
) -> CaseTimelineEvent:
    """Save the offline document verification checklist (§47).

    The completed checklist becomes part of the case evidence, recorded as a
    timeline event and audit log entry.
    """
    checked_count = sum(1 for v in checklist.values() if v)
    total_count = len(checklist)

    event = CaseTimelineEvent(
        case_id=case_id,
        task_id=task_id,
        event_type="VERIFICATION_CHECKLIST_SUBMITTED",
        actor_id=str(user.id),
        actor_role=user.role,
        event_metadata={
            "checklist": checklist,
            "remarks": remarks,
            "checked_count": checked_count,
            "total_count": total_count,
        },
    )
    db.add(event)

    audit_service.log_case_mutation(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="VERIFICATION_CHECKLIST_SUBMITTED",
        entity_type="VerificationChecklist",
        entity_id=task_id,
        case_id=case_id,
        task_id=task_id,
        metadata={"checked_count": checked_count, "total_count": total_count, "remarks": remarks},
    )

    db.commit()
    db.refresh(event)
    return event


# --- Phase 5: Verifier Field Workflow ---


def assign_verifier_to_task(
    db: Session,
    *,
    task_id: str,
    verifier_id: str,
    user: User,
) -> DepartmentTask | str:
    """Assign a verifier to a department task (§29).

    Officer assigns an existing verifier. The task must be in a state
    that supports field verification (FIELD_VERIFICATION or OFFLINE_APPOINTMENT
    resolution mode, or any task for officer assignment discretion).
    """
    task = get_task(db, task_id)
    if task is None:
        return TASK_NOT_FOUND

    if user.role == "ADMIN":
        pass
    elif not _can_manage_task(user, task, db):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    if task.resolution_mode not in ("FIELD_VERIFICATION", "OFFLINE_APPOINTMENT", "HYBRID") and task.status not in ("PENDING", "ASSIGNED", "IN_PROGRESS", "BLOCKED"):
        return VERIFY_TASK_NOT_ASSIGNABLE

    task.assigned_verifier_id = verifier_id
    task.assigned_at = _now()
    task.updated_at = _now()
    db.flush()

    case = get_case(db, str(task.case_id))
    _add_timeline_event(
        db,
        case if not isinstance(case, str) else None,
        "VERIFIER_ASSIGNED",
        actor_id=str(user.id),
        actor_role=user.role,
        previous_state=task.status,
        new_state=task.status,
        metadata={"taskId": task_id, "verifierId": verifier_id},
    )

    audit_service.log_case_mutation(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="VERIFIER_ASSIGNED",
        entity_type="DEPARTMENT_TASK",
        entity_id=task_id,
        case_id=str(task.case_id),
        task_id=task_id,
        parcel_id=case.parcel_id if not isinstance(case, str) else None,
        previous_value={"assigned_verifier_id": None},
        new_value={"assigned_verifier_id": verifier_id},
        reason=f"Verifier {verifier_id} assigned to task",
        metadata={"taskId": task_id, "verifierId": verifier_id},
    )

    _notify_verifier_assigned(db, task, case, verifier_id, user)
    db.commit()
    db.refresh(task)
    return task


def _notify_verifier_assigned(db: Session, task: DepartmentTask, case: Case | str | None, verifier_id: str, user: User) -> None:
    """Notify a verifier that a new field-visit task has been assigned to them (§50)."""
    from app.services.notification_feed_service import NotificationPayload, notify_users

    case_no = case.case_no if not isinstance(case, str) else ""
    dept_code = _resolve_department_code(db, str(task.department_id)) if task.department_id else "a department"
    message = f"A new field verification task has been assigned to you in the {dept_code} department for case {case_no}."

    notify_users(
        db,
        [verifier_id],
        NotificationPayload(
            type="VERIFIER_ASSIGNED",
            title=f"New Field Verification Task — {dept_code}",
            message=message,
            parcel_id=case.parcel_id if not isinstance(case, str) else None,
            case_id=str(task.case_id),
        ),
    )


def get_case_package(
    db: Session,
    *,
    case_id: str,
    user: User,
) -> dict[str, Any] | str:
    """Build the offline case package for a verifier (§30).

    Aggregates: case, parcel, parcel 360 data, application, department routes,
    task instructions, and relevant parcel information — everything the verifier
    needs to perform the field task offline.
    """
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    if not _can_view_case(user, case, db):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    from app.services import parcels_service, response_aggregator_service
    from app.services import departments_service

    parcel_360 = response_aggregator_service.build_parcel_360(db, case.parcel_id)

    tasks = get_tasks_for_case(db, case_id)
    timeline = get_timeline(db, case_id)
    ai_analysis = get_ai_analysis(db, case_id)
    routing = get_routing_decision(db, case_id)

    application = db.query(Application).filter_by(case_id=case_id).first()

    department_records: dict[str, Any] = {}
    for task in tasks:
        dept_code = _resolve_department_code(db, str(task.department_id)) if task.department_id else ""
        if dept_code:
            finder_map = {
                "REGISTRATION": departments_service.find_registration_by_parcel,
                "PLANNING": departments_service.find_planning_by_parcel,
                "TAX": departments_service.find_tax_by_parcel,
                "RESTRICTION": departments_service.find_restriction_by_parcel,
                "DISPUTE": departments_service.find_dispute_by_parcel,
                "ENCUMBRANCE": departments_service.find_encumbrance_by_parcel,
                "SURVEY": departments_service.find_survey_by_parcel,
            }
            finder = finder_map.get(dept_code.upper())
            if finder:
                record = finder(db, case.parcel_id)
                department_records[dept_code] = record

    task_instructions: list[dict[str, Any]] = []
    for task in tasks:
        task_instructions.append({
            "taskId": str(task.id),
            "department": _resolve_department_code(db, str(task.department_id)) if task.department_id else "",
            "departmentId": str(task.department_id) if task.department_id else None,
            "resolutionMode": task.resolution_mode,
            "stageName": task.stage_name,
            "status": task.status,
            "resolutionDecision": task.resolution_decision,
            "resolutionRemarks": task.resolution_remarks,
            "assignedOfficerId": task.assigned_officer_id,
            "assignedVerifierId": task.assigned_verifier_id,
            "assignedAt": task.assigned_at.isoformat() if task.assigned_at else None,
            "deadlineHours": task.sla_threshold_hours,
        })

    parcel = None
    try:
        from app.models.parcel import Parcel as ParcelModel
        parcel = db.get(ParcelModel, case.parcel_id)
    except Exception:  # noqa: BLE001
        parcel = None

    evidence: list = []
    try:
        from app.models.verification_evidence import VerificationEvidence as VEModel
        if hasattr(VEModel, "case_id"):
            evidence = (
                db.query(VEModel)
                .filter(VEModel.case_id == case_id)
                .order_by(VEModel.captured_at.desc())
                .all()
            )
    except Exception:  # noqa: BLE001
        evidence = []

    return {
        "case": CaseOut_dict(case),
        "parcel": Parcel_dict(parcel) if parcel else None,
        "parcel360": parcel_360,
        "application": Application_dict(application) if application else None,
        "tasks": [DeptTask_dict(t) for t in tasks],
        "taskInstructions": task_instructions,
        "departmentRecords": department_records,
        "timeline": [Timeline_dict(e) for e in timeline],
        "aiAnalysis": AIAnalysis_dict(ai_analysis) if ai_analysis else None,
        "routingDecision": Routing_dict(routing) if routing else None,
        "evidence": [Evidence_dict(e) for e in evidence],
    }


def CaseOut_dict(case: Case) -> dict:
    return {
        "id": str(case.id),
        "caseNo": case.case_no,
        "citizenId": case.citizen_id,
        "parcelId": case.parcel_id,
        "intent": case.intent,
        "status": case.status,
        "priority": case.priority,
        "createdAt": case.created_at.isoformat() if case.created_at else None,
        "resolvedAt": case.resolved_at.isoformat() if case.resolved_at else None,
        "closedAt": case.closed_at.isoformat() if case.closed_at else None,
    }


def Parcel_dict(parcel) -> dict:
    return {
        "id": str(parcel.id) if parcel.id else None,
        "ulpin": parcel.ulpin if hasattr(parcel, 'ulpin') else None,
        "surveyNo": parcel.survey_no if hasattr(parcel, 'survey_no') else None,
        "area": float(parcel.area_sq_m) if getattr(parcel, 'area_sq_m', None) else None,
        "owner": parcel.owner if hasattr(parcel, 'owner') else None,
        # Human-readable location so a verifier navigates to the site by address,
        # not by a bare ULPIN/survey code.
        "streetAddress": getattr(parcel, 'street_address', None),
        "locality": getattr(parcel, 'locality', None),
        "landmark": getattr(parcel, 'landmark', None),
        "pincode": getattr(parcel, 'pincode', None),
        "stateCode": getattr(parcel, 'state_code', None),
        "districtCode": getattr(parcel, 'district_code', None),
        "geometry": None,
    }


def DeptTask_dict(task: DepartmentTask) -> dict:
    return {
        "id": str(task.id),
        "caseId": str(task.case_id),
        "departmentId": str(task.department_id) if task.department_id else None,
        "status": task.status,
        "resolutionMode": task.resolution_mode,
        "resolutionDecision": task.resolution_decision,
        "resolutionRemarks": task.resolution_remarks,
        "assignedOfficerId": task.assigned_officer_id,
        "assignedVerifierId": task.assigned_verifier_id,
        "stage": task.stage,
        "stageName": task.stage_name,
        "slaThresholdHours": float(task.sla_threshold_hours) if task.sla_threshold_hours else None,
        "createdAt": task.created_at.isoformat() if task.created_at else None,
        "updatedAt": task.updated_at.isoformat() if task.updated_at else None,
        "completedAt": task.completed_at.isoformat() if task.completed_at else None,
    }


def Application_dict(application: Application) -> dict:
    return {
        "id": str(application.id),
        "caseId": str(application.case_id),
        "originalInput": application.original_input,
        "aiDraft": application.ai_draft,
        "citizenEditedVersion": application.citizen_edited_version,
        "finalSubmittedVersion": application.final_submitted_version,
        "citizenConfirmed": application.citizen_confirmed,
        "citizenConfirmationTimestamp": application.citizen_confirmation_timestamp.isoformat() if application.citizen_confirmation_timestamp else None,
        "generatedDocumentPath": application.generated_document_path,
        "generatedAt": application.generated_at.isoformat() if application.generated_at else None,
    }


def Timeline_dict(event: CaseTimelineEvent) -> dict:
    return {
        "id": str(event.id),
        "caseId": str(event.case_id),
        "taskId": str(event.task_id) if event.task_id else None,
        "eventType": event.event_type,
        "actorId": event.actor_id,
        "actorRole": event.actor_role,
        "previousState": event.previous_state,
        "newState": event.new_state,
        "metadata": event.event_metadata,
        "createdAt": event.created_at.isoformat() if event.created_at else None,
    }


def AIAnalysis_dict(analysis: AIAnalysis) -> dict:
    return {
        "id": str(analysis.id),
        "caseId": str(analysis.case_id),
        "structuredUnderstanding": analysis.structured_understanding,
        "factsStated": analysis.facts_stated,
        "factsVerified": analysis.facts_verified,
        "departmentsIdentified": analysis.departments_identified,
        "applicationDraft": analysis.application_draft,
        "followUpQuestions": analysis.follow_up_questions,
        "conversation": analysis.conversation,
        "createdAt": analysis.created_at.isoformat() if analysis.created_at else None,
    }


def Routing_dict(routing: RoutingDecision) -> dict:
    return {
        "id": str(routing.id),
        "caseId": str(routing.case_id),
        "departmentsRouted": routing.departments_routed,
        "workflowPerDepartment": routing.workflow_per_department,
        "priority": routing.priority,
        "createdAt": routing.created_at.isoformat() if routing.created_at else None,
    }


def Evidence_dict(evidence: Any) -> dict:
    return {
        "id": str(evidence.id),
        "caseId": str(evidence.case_id) if hasattr(evidence, 'case_id') else None,
        "verifierId": evidence.verifier_id,
        "latitude": evidence.latitude,
        "longitude": evidence.longitude,
        "accuracyM": float(evidence.accuracy_m) if hasattr(evidence, 'accuracy_m') and evidence.accuracy_m else None,
        "capturedAt": evidence.captured_at.isoformat() if evidence.captured_at else None,
        "photoHash": evidence.photo_hash if hasattr(evidence, 'photo_hash') else None,
        "sequence": evidence.sequence if hasattr(evidence, 'sequence') else None,
        "notes": evidence.notes,
    }


def capture_evidence(
    db: Session,
    *,
    case_id: str,
    verifier_id: str,
    latitude: float,
    longitude: float,
    accuracy_m: float | None = None,
    photo_hash: str | None = None,
    sequence: int | None = None,
    captured_at: datetime | None = None,
    notes: str | None = None,
    task_id: str | None = None,
) -> VerificationEvidence | str:
    """Capture GPS + photo evidence submitted by a verifier (§31).

    Creates a VerificationEvidence record linked to the case (and optionally
    a department task), with an evidence_id prefixed ``EVID-`` for human-
    readable reference. Records a GPS_CAPTURED / PHOTO_CAPTURED timeline
    event on the case.
    """
    from app.models.verification_evidence import VerificationEvidence as VEModel

    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    evidence = VEModel(
        case_id=case_id,
        task_id=task_id,
        evidence_id=_generate_evidence_id(db),
        verifier_id=verifier_id,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
        captured_at=captured_at or _now(),
        photo_hash=photo_hash,
        sequence=sequence,
        notes=notes,
    )
    db.add(evidence)
    db.flush()

    _add_timeline_event(
        db,
        case,
        "GPS_CAPTURED",
        actor_id=verifier_id,
        actor_role="VERIFIER",
        previous_state=case.status,
        new_state=case.status,
        metadata={"evidenceId": evidence.evidence_id, "taskId": task_id},
    )

    if photo_hash:
        _add_timeline_event(
            db,
            case,
            "PHOTO_CAPTURED",
            actor_id=verifier_id,
            actor_role="VERIFIER",
            previous_state=case.status,
            new_state=case.status,
            metadata={"evidenceId": evidence.evidence_id, "photoHash": photo_hash},
        )

    db.commit()
    db.refresh(evidence)
    return evidence


def _generate_evidence_id(db: Session) -> str:
    """Generate a unique human-readable evidence ID like EVID-2026-00042."""
    from app.models.verification_evidence import VerificationEvidence as VEModel
    year = datetime.now().year
    count = db.query(VEModel).filter(
        VEModel.evidence_id.like(f"EVID-{year}-%")
    ).count()
    while True:
        candidate = f"EVID-{year}-{count + 1:05d}"
        existing = db.query(VEModel).filter_by(evidence_id=candidate).first()
        if existing is None:
            return candidate
        count += 1
    return candidate


def get_verifier_evidence(db: Session, case_id: str, verifier_id: str | None = None) -> list:
    """List evidence records for a case (optionally filtered by verifier)."""
    from app.models.verification_evidence import VerificationEvidence as VEModel
    query = db.query(VEModel).filter(VEModel.case_id == case_id)
    if verifier_id:
        query = query.filter(VEModel.verifier_id == verifier_id)
    return query.order_by(VEModel.captured_at.desc()).all()


def submit_verifier_findings(
    db: Session,
    *,
    case_id: str,
    verifier_id: str,
    findings: list[dict],
    overall_finding: str,
    declaration_confirmed: bool,
    task_id: str | None = None,
    notes: str | None = None,
) -> CaseTimelineEvent | str:
    """Submit a verifier's field findings (§32).

    Findings are a list of {field, finding, description} entries.
    overall_finding is one of: SUPPORTED, NOT_VERIFIED, CONTRADICTED,
    PARTIALLY_VERIFIED, UNABLE_TO_DETERMINE.

    Requires declaration_confirmed to be True.
    """
    case = get_case(db, case_id)
    if isinstance(case, str):
        return case

    if not declaration_confirmed:
        return FORBIDDEN

    valid_findings = {"SUPPORTED", "NOT_VERIFIED", "CONTRADICTED", "PARTIALLY_VERIFIED", "UNABLE_TO_DETERMINE"}
    if overall_finding not in valid_findings:
        return FORBIDDEN

    event = CaseTimelineEvent(
        case_id=case_id,
        task_id=task_id,
        event_type="VERIFICATION_SUBMITTED",
        actor_id=verifier_id,
        actor_role="VERIFIER",
        event_metadata={
            "findings": findings,
            "overallFinding": overall_finding,
            "declarationConfirmed": declaration_confirmed,
            "notes": notes,
        },
    )
    db.add(event)

    audit_service.log_case_mutation(
        db,
        user_id=verifier_id,
        user_role="VERIFIER",
        action="VERIFICATION_SUBMITTED",
        entity_type="VerificationFindings",
        entity_id=str(case_id),
        case_id=case_id,
        task_id=task_id,
        metadata={
            "findings": findings,
            "overallFinding": overall_finding,
            "declarationConfirmed": declaration_confirmed,
        },
    )

    db.commit()
    db.refresh(event)
    return event


VERIFY_FINDING_VALUES = ["SUPPORTED", "NOT_VERIFIED", "CONTRADICTED", "PARTIALLY_VERIFIED", "UNABLE_TO_DETERMINE"]
