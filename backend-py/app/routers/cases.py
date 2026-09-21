"""Case management endpoints (§6, §9, §18, §57, §59).

Case creation, lifecycle, department tasks, timeline,
appointments, feedback, AI analysis, routing.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, get_current_user_optional, require_roles
from app.auth.roles import ALL_STAFF_ROLES, CITIZEN_ROLE, VERIFIER_ROLE
from app.database import get_db
from app.models.case import Application, Case
from app.models.user import User
from app.schemas.case import (
    AIAnalysisOut,
    AppointmentCreate,
    AppointmentOut,
    AppointmentUpdate,
    ApplicationCreate,
    ApplicationOut,
    CaseCreate,
    CaseDetailOut,
    CaseListResponse,
    CaseOut,
    CaseStatusUpdate,
    CaseTimelineEventOut,
    DepartmentTaskOut,
    EvidenceCaptureRequest,
    EvidenceCaptureResponse,
    FeedbackCreate,
    FeedbackOut,
    FieldChangeApprovalIn,
    ProposedFieldChangeIn,
    ProposedFieldChangeOut,
    TaskAdvanceIn,
    TaskAssignIn,
    TaskResolveIn,
    VerificationChecklistIn,
    VerifierAssignmentIn,
    VerifierAssignmentOut,
    VerifierFindingOut,
    VerifierFindingsIn,
    VerifierPackageOut,
)
from app.services import audit_service, case_service as service

router = APIRouter(prefix="/cases", tags=["cases"])


def _not_found_case(case_id) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case not found: {case_id}")


@router.post("", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(
    request: Request,
    dto: CaseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(CITIZEN_ROLE)),
):
    result = service.create_case(
        db,
        citizen_id=str(user.id),
        parcel_id=str(dto.parcel_id),
        intent=dto.intent,
        priority=dto.priority,
        user=user,
    )
    if isinstance(result, str):
        if result == service.PARCEL_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel not found")
        if result == service.ACTIVE_CASE_EXISTS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active case already exists for this citizen and parcel",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)

    audit_service.log(
        db,
        user_id=str(user.id),
        user_role=user.role,
        action="CASE_CREATED",
        entity_type="CASE",
        entity_id=str(result.id),
        parcel_id=dto.parcel_id,
        metadata={"caseNo": result.case_no, "intent": dto.intent},
    )
    return result


@router.get("", response_model=CaseListResponse)
def list_cases(
    case_no: str | None = None,
    citizen_id: str | None = None,
    parcel_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    if user.role == CITIZEN_ROLE:
        citizen_id = citizen_id or str(user.id)
        if not citizen_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="citizenId required for citizen role")

    query = db.query(Case)
    if case_no:
        query = query.filter(Case.case_no == case_no)
    if citizen_id:
        query = query.filter(Case.citizen_id == citizen_id)
    if parcel_id:
        query = query.filter(Case.parcel_id == parcel_id)
    if status:
        query = query.filter(Case.status == status)

    total = query.count()
    cases = query.order_by(Case.created_at.desc()).offset(offset).limit(limit).all()
    return CaseListResponse(cases=cases, total=total)


@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    return result


@router.get("/{case_id}/detail", response_model=CaseDetailOut)
def get_case_detail(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    result = service.get_case_detail(db, str(case_id), user)
    if isinstance(result, str):
        raise _not_found_case(case_id)
    return result


@router.patch("/{case_id}/status", response_model=CaseOut)
def update_case_status(
    case_id: UUID,
    dto: CaseStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    result = service.update_case_status(db, str(case_id), dto.status, user, dto.remarks)
    if isinstance(result, str):
        if result == service.CASE_NOT_FOUND:
            raise _not_found_case(case_id)
        if result == service.INVALID_STATUS_TRANSITION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from {result}",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.post("/{case_id}/tasks", response_model=CaseDetailOut)
def add_task(
    case_id: UUID,
    department_id: UUID,
    workflow_id: UUID | None = None,
    stage_name: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    result = service.add_department_task(db, str(case_id), str(department_id), str(workflow_id) if workflow_id else None, stage_name)
    if isinstance(result, str):
        raise _not_found_case(case_id)
    case = service.get_case(db, str(case_id))
    if isinstance(case, str):
        raise _not_found_case(case_id)
    return service.get_case_detail(db, str(case_id), user)


@router.get("/{case_id}/tasks")
def get_tasks(case_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE))):
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    tasks = service.get_tasks_for_case(db, str(case_id))
    return tasks


@router.get("/{case_id}/tasks/{task_id}", response_model=DepartmentTaskOut)
def get_task(
    case_id: UUID,
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    """Get a specific department task (§18, §59)."""
    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    task = service.get_task(db, str(task_id))
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found: {task_id}",
        )
    return task


@router.get("/{case_id}/tasks/{task_id}/sla")
def get_task_sla(
    case_id: UUID,
    task_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    """Check a department task's SLA status (§56).

    Returns OK, WARNING, or BREACH based on elapsed time vs configured thresholds.
    """
    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    sla_status = service.check_task_sla(db, str(task_id))
    if sla_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No SLA configuration found for task: {task_id}",
        )
    return sla_status


@router.post("/{case_id}/tasks/{task_id}/assign", response_model=DepartmentTaskOut)
def assign_task(
    case_id: UUID,
    task_id: UUID,
    dto: TaskAssignIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Assign an officer to a department task (§59, §60).

    Transitions task from PENDING → ASSIGNED.
    Only ADMIN or department-matched officers may assign.
    """
    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    result = service.assign_task(db, str(task_id), dto.officer_id, user)
    if isinstance(result, str):
        if result == service.TASK_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found: {task_id}",
            )
        if result == service.INVALID_TASK_TRANSITION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task cannot be assigned from its current status",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.patch("/{case_id}/tasks/{task_id}/advance", response_model=DepartmentTaskOut)
def advance_task(
    case_id: UUID,
    task_id: UUID,
    dto: TaskAdvanceIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Advance a department task through workflow stages (§23, §26).

    Validates the transition is legal per TASK_STATUS_TRANSITIONS.
    """
    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    result = service.advance_task(
        db,
        str(task_id),
        dto.status,
        user,
        dto.stage_name,
        dto.remarks,
    )
    if isinstance(result, str):
        if result == service.TASK_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found: {task_id}",
            )
        if result == service.INVALID_TASK_TRANSITION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task status transition to: {dto.status}",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.post("/{case_id}/tasks/{task_id}/resolve", response_model=DepartmentTaskOut)
def resolve_task(
    case_id: UUID,
    task_id: UUID,
    dto: TaskResolveIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Apply a resolution decision to a department task (§34, §36).

    Decision is APPROVE | REJECT | RETURN_FOR_REVIEW.
    """
    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    result = service.resolve_task(
        db,
        str(task_id),
        dto.decision,
        dto.officer_id,
        dto.remarks,
        user,
    )
    if isinstance(result, str):
        if result == service.TASK_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found: {task_id}",
            )
        if result == service.INVALID_TASK_TRANSITION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task has already been completed and cannot be resolved again",
            )
        if result == service.INVALID_DECISION_ACTION:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid decision action. Must be APPROVE, REJECT, or RETURN_FOR_REVIEW",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.post("/{case_id}/tasks/{task_id}/verification-checklist", response_model=CaseTimelineEventOut)
def submit_verification_checklist(
    case_id: UUID,
    task_id: UUID,
    dto: VerificationChecklistIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Submit the offline document verification checklist (§47).

    The completed checklist becomes part of the case evidence.
    """
    result = service.save_verification_checklist(
        db,
        task_id=str(task_id),
        case_id=str(case_id),
        checklist=dict(dto.checklist),
        remarks=dto.remarks or "",
        user=user,
    )
    return result


@router.post("/{case_id}/field-proposals", response_model=ProposedFieldChangeOut, status_code=status.HTTP_201_CREATED)
def create_field_proposal(
    case_id: UUID,
    dto: ProposedFieldChangeIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Propose a field change for officer approval (§37)."""
    result = service.propose_field_change(
        db,
        case_id=str(case_id),
        parcel_id=dto.parcel_id,
        department=dto.department,
        field_name=dto.field_name,
        current_value=dto.current_value,
        proposed_value=dto.proposed_value,
        reason=dto.reason,
        proposed_by=str(user.id),
    )
    return result


@router.get("/{case_id}/field-proposals", response_model=list[ProposedFieldChangeOut])
def list_field_proposals(
    case_id: UUID,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """List proposed field changes for a case (§37)."""
    return service.get_proposed_field_changes(db, case_id=str(case_id), status=status)


@router.post("/{case_id}/field-proposals/{proposal_id}/approve", response_model=ProposedFieldChangeOut)
def approve_field_proposal(
    case_id: UUID,
    proposal_id: UUID,
    dto: FieldChangeApprovalIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Approve a proposed field change (§37–§40).

    Performs a transactional database update: reads current value, validates
    officer permission, creates historical version, updates current record,
    logs audit event linked to the case, creates timeline event.
    """
    result = service.approve_field_change(
        db,
        proposal_id=str(proposal_id),
        user=user,
        remarks=dto.remarks,
    )
    if isinstance(result, str):
        if result == service.PROPOSAL_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Proposal not found: {proposal_id}")
        if result == service.PROPOSAL_NOT_PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Proposal is already resolved")
        if result == service.FORBIDDEN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to approve changes for this department")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.post("/{case_id}/field-proposals/{proposal_id}/reject", response_model=ProposedFieldChangeOut)
def reject_field_proposal(
    case_id: UUID,
    proposal_id: UUID,
    dto: FieldChangeApprovalIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Reject a proposed field change (§37)."""
    result = service.reject_field_change(
        db,
        proposal_id=str(proposal_id),
        user=user,
        remarks=dto.remarks,
    )
    if isinstance(result, str):
        if result == service.PROPOSAL_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Proposal not found: {proposal_id}")
        if result == service.PROPOSAL_NOT_PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Proposal is already resolved")
        if result == service.FORBIDDEN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to reject changes for this department")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.get("/{case_id}/documents/decision-order")
def generate_decision_order(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Generate the Officer Decision Order PDF (§49).

    Contains: Case ID, Parcel info, Citizen info, Application summary,
    Department task decisions, Officer decision, Authorized officer info.
    """
    from app.common.parcel_generation.decision_document_generator import generate_decision_order_pdf
    from app.services.decision_document_data_service import build_decision_document_data
    from fastapi.responses import StreamingResponse
    import io as _io

    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    doc_data = build_decision_document_data(db, str(case_id), str(user.id), user.role)
    if isinstance(doc_data, str):
        raise _not_found_case(case_id)

    pdf_bytes = generate_decision_order_pdf(doc_data)

    buf = _io.BytesIO(pdf_bytes)
    filename = f"decision-order-{doc_data.case_no}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@router.get("/{case_id}/documents/verification-report")
def generate_verification_report(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Generate the Verification Report PDF (§49).

    Contains: Case info, evidence summary, department decisions, case timeline.
    """
    from app.common.parcel_generation.decision_document_generator import generate_verification_report_pdf
    from app.services.decision_document_data_service import build_decision_document_data
    from fastapi.responses import StreamingResponse
    import io as _io

    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    doc_data = build_decision_document_data(db, str(case_id))
    if isinstance(doc_data, str):
        raise _not_found_case(case_id)

    pdf_bytes = generate_verification_report_pdf(doc_data)

    buf = _io.BytesIO(pdf_bytes)
    filename = f"verification-report-{doc_data.case_no}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@router.post("/{case_id}/ai-analysis", response_model=AIAnalysisOut)
def create_ai_analysis(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    result = service.create_ai_analysis(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    return result


@router.post("/{case_id}/routing", response_model=CaseDetailOut)
def route_case(
    case_id: UUID,
    body: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Route case to departments based on AI routing decision (§17)."""
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)

    departments_routed = body.get("departments") if body else None
    workflow_per_department = body.get("workflowPerDepartment") if body else None
    priority = body.get("priority") if body else None

    decision = service.create_routing_decision(
        db, str(case_id), departments_routed, workflow_per_department, priority
    )
    if isinstance(decision, str):
        raise _not_found_case(case_id)

    # Update case status to ACTIVE after routing
    service.update_case_status(db, str(case_id), "ACTIVE", user)

    return service.get_case_detail(db, str(case_id), user)


@router.post("/{case_id}/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    case_id: UUID,
    dto: AppointmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    result = service.create_appointment(
        db,
        case_id=str(case_id),
        citizen_id=dto.citizen_id,
        department_id=str(dto.department_id),
        officer_id=dto.officer_id,
        office_location=dto.office_location,
        date=dto.date,
        time_slot=dto.time_slot,
        purpose=dto.purpose,
        required_documents=dto.required_documents,
    )
    if isinstance(result, str):
        raise _not_found_case(case_id)
    return result


@router.get("/{case_id}/appointments", response_model=list[AppointmentOut])
def list_appointments(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    """List all appointments for a case (§46)."""
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    return service.get_appointments(db, str(case_id))


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment_detail(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    """Get a single appointment by id (§45, §46)."""
    appt = service.get_appointment(db, str(appointment_id))
    if appt is None:
        raise _not_found_case(appointment_id)
    case_result = service.get_case(db, str(appt.case_id))
    if isinstance(case_result, str):
        raise _not_found_case(appt.case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    return appt


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment_endpoint(
    appointment_id: UUID,
    dto: AppointmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    """Update an appointment — citizen can request, officer confirms/completes (§45, §46)."""
    appt = service.get_appointment(db, str(appointment_id))
    if appt is None:
        raise _not_found_case(appointment_id)
    case_result = service.get_case(db, str(appt.case_id))
    if isinstance(case_result, str):
        raise _not_found_case(appt.case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    update_data = dto.model_dump(exclude_unset=True)
    update_kwargs = {k: v for k, v in update_data.items() if v is not None}

    try:
        result = service.update_appointment(db, str(appointment_id), **update_kwargs)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result


@router.get("/{case_id}/timeline", response_model=list[CaseTimelineEventOut])
def get_timeline(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    events = service.get_timeline(db, str(case_id))
    return events


@router.post("/{case_id}/timeline-events", response_model=CaseTimelineEventOut)
def add_timeline_event(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
    event_type: str = None,
    actor_id: str = None,
    actor_role: str = None,
    previous_state: str = None,
    new_state: str = None,
    metadata: dict | None = None,
    task_id: str = None,
):
    result = service.add_timeline_event(
        db,
        str(case_id),
        event_type or "CASE_CREATED",
        actor_id,
        actor_role,
        previous_state,
        new_state,
        metadata,
        task_id,
    )
    if isinstance(result, str):
        raise _not_found_case(case_id)
    return result


@router.get("/{case_id}/feedback", response_model=list[FeedbackOut])
def get_feedback(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    return service.get_feedback_for_case(db, str(case_id))


@router.post("/{case_id}/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    case_id: UUID,
    dto: FeedbackCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(CITIZEN_ROLE)),
):
    result = service.submit_feedback(
        db,
        case_id=str(case_id),
        citizen_id=str(user.id),
        category=dto.category,
        officer_rating=dto.officer_rating,
        overall_case_rating=dto.overall_case_rating,
        type=dto.type,
        comments=dto.comments,
        reasons=dto.reasons,
        is_anonymous=dto.is_anonymous,
        officer_id=dto.officer_id,
        department_id=str(dto.department_id) if dto.department_id else None,
        task_id=str(dto.task_id) if dto.task_id else None,
    )
    if isinstance(result, str):
        raise _not_found_case(case_id)
    return result


@router.get("/{case_id}/ai-analysis")
def get_ai_analysis(case_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE))):
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    return service.get_ai_analysis(db, str(case_id))


@router.get("/{case_id}/routing")
def get_routing_decision(case_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE))):
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    return service.get_routing_decision(db, str(case_id))


@router.get("/{case_id}/sla")
def get_case_sla(case_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE))):
    result = service.get_case(db, str(case_id))
    if isinstance(result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    return service.get_active_slas_for_case(db, str(case_id))


@router.get("/{case_id}/active")
def get_active_case_for_parcel(
    parcel_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional),
):
    """Check if an active case exists for a parcel (§6, Invariant 1)."""
    result = service.get_active_case_for_parcel(db, parcel_id)
    if result is None:
        return {"hasActiveCase": False}
    return {"hasActiveCase": True, "case": CaseOut.model_validate(result)}


@router.get("/my", response_model=CaseListResponse)
def get_my_cases(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(CITIZEN_ROLE)),
):
    """Get all cases for the authenticated citizen."""
    cases = service.get_cases_by_citizen(db, str(user.id))
    total = len(cases)
    paginated = cases[offset : offset + limit]
    return CaseListResponse(
        cases=[CaseOut.model_validate(c) for c in paginated],
        total=total,
    )


@router.post("/from-application", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case_from_application(
    request: Request,
    dto: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(CITIZEN_ROLE)),
):
    """Create a case from the citizen's confirmed application (§9, §17, §18).

    The citizen has already: described the issue, reviewed AI understanding,
    reviewed/edited the application draft, and explicitly confirmed. This
    endpoint creates the case, persists the AI analysis + application
    versioning, routes to departments, and transitions the case to ACTIVE.
    """
    result = service.create_case_from_application(
        db,
        citizen_id=str(user.id),
        parcel_id=dto.parcel_id,
        intent=dto.intent,
        priority=dto.priority,
        application_draft=dto.application_draft,
        citizen_edited_version=dto.citizen_edited_version,
        ai_structured_understanding=dto.ai_structured_understanding,
        facts_database=dto.facts_database,
        citizen_statements=dto.citizen_statements,
        conversation=dto.conversation,
        routing_result=dto.routing_result,
        user=user,
    )
    if isinstance(result, str):
        if result == service.PARCEL_NOT_FOUND:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parcel not found")
        if result == service.ACTIVE_CASE_EXISTS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active case already exists for this citizen and parcel",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)

    return result


@router.get("/{case_id}/application", response_model=ApplicationOut)
def get_application(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    """Get the application artifact for a case (§14, §16)."""
    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    app_record = db.query(Application).filter_by(case_id=case_id).first()
    if app_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Application not found for case: {case_id}")
    return app_record


@router.get("/parcel/{parcel_id}", response_model=CaseListResponse)
def get_cases_by_parcel(
    parcel_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE)),
):
    """Get all cases for a parcel."""
    result = service.get_case(db, parcel_id)
    if isinstance(result, str):
        raise _not_found_case(parcel_id)
    if not service._can_manage_case(user, result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")
    cases = service.get_cases_by_parcel(db, parcel_id)
    return CaseListResponse(
        cases=[CaseOut.model_validate(c) for c in cases],
        total=len(cases),
    )


@router.get("/tasks/my", response_model=list[DepartmentTaskOut])
def get_my_tasks(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Get department tasks assigned to the currently authenticated officer (§59)."""
    tasks = service.get_tasks_for_officer(db, str(user.id), skip, limit)
    return [DepartmentTaskOut.model_validate(t) for t in tasks]


@router.get("/verifier/tasks", response_model=list[DepartmentTaskOut])
def get_verifier_tasks(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(VERIFIER_ROLE)),
):
    """Get department tasks assigned to the currently authenticated verifier (§29, §30)."""
    from app.models.case import DepartmentTask
    tasks = (
        db.query(DepartmentTask)
        .filter(DepartmentTask.assigned_verifier_id == str(user.id))
        .order_by(DepartmentTask.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return tasks


@router.patch("/{task_id}/assign-verifier", response_model=VerifierAssignmentOut)
def assign_verifier_to_task_endpoint(
    task_id: UUID,
    dto: VerifierAssignmentIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Assign a verifier to a department task (§29).

    Officer assigns an existing verifier. The task must support field
    verification or offline appointment resolution modes.
    """
    result = service.assign_verifier_to_task(
        db,
        task_id=str(task_id),
        verifier_id=dto.verifier_id,
        user=user,
    )
    if isinstance(result, str):
        if result == service.TASK_NOT_FOUND:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found: {task_id}",
            )
        if result == service.VERIFY_TASK_NOT_ASSIGNABLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This task is not eligible for verifier assignment",
            )
        if result == service.FORBIDDEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to assign verifiers for this department",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.get("/{case_id}/verifier-package", response_model=VerifierPackageOut)
def get_verifier_package(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(VERIFIER_ROLE)),
):
    """Get the offline case package for a verifier (§30).

    Aggregates case, parcel, parcel 360 data, application, department
    records, task instructions, timeline, AI analysis, routing, and
    existing evidence — everything needed for the field visit.
    """
    result = service.get_case_package(db, case_id=str(case_id), user=user)
    if isinstance(result, str):
        raise _not_found_case(case_id)
    return result


@router.post("/{case_id}/evidence/capture", response_model=EvidenceCaptureResponse, status_code=status.HTTP_201_CREATED)
def capture_evidence_endpoint(
    case_id: UUID,
    dto: EvidenceCaptureRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(VERIFIER_ROLE)),
):
    """Capture GPS + photo evidence by a verifier (§31).

    Requires the verifier to be assigned to a department task on this case.
    """
    from app.models.case import DepartmentTask
    assigned_task = (
        db.query(DepartmentTask)
        .filter(
            DepartmentTask.case_id == case_id,
            DepartmentTask.assigned_verifier_id == str(user.id),
        )
        .first()
    )
    if assigned_task is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned as verifier for this case",
        )

    result = service.capture_evidence(
        db,
        case_id=str(case_id),
        verifier_id=str(user.id),
        latitude=dto.latitude,
        longitude=dto.longitude,
        accuracy_m=dto.accuracy_m,
        captured_at=dto.captured_at,
        photo_hash=dto.photo_hash,
        sequence=dto.sequence,
        notes=dto.notes,
        task_id=str(dto.task_id) if dto.task_id else str(assigned_task.id),
    )
    if isinstance(result, str):
        if result == service.CASE_NOT_FOUND:
            raise _not_found_case(case_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result


@router.get("/{case_id}/evidence", response_model=list[EvidenceCaptureResponse])
def list_evidence(
    case_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ALL_STAFF_ROLES, VERIFIER_ROLE)),
):
    """List evidence captured for a case (§31, §33). Officers see all; verifiers see their own."""
    case_result = service.get_case(db, str(case_id))
    if isinstance(case_result, str):
        raise _not_found_case(case_id)
    if not service._can_manage_case(user, case_result, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden resource")

    verifier_id = str(user.id) if user.role == VERIFIER_ROLE else None
    evidence = service.get_verifier_evidence(db, str(case_id), verifier_id)
    return evidence


@router.post("/{case_id}/findings", response_model=VerifierFindingOut, status_code=status.HTTP_201_CREATED)
def submit_verifier_findings_endpoint(
    case_id: UUID,
    dto: VerifierFindingsIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(VERIFIER_ROLE)),
):
    """Submit verifier findings from a field visit (§32).

    Findings include supported/verified, not-verified, contradicted,
    partially-verified, or unable-to-determine verdicts with mandatory
    descriptions. Requires a declaration confirmation.
    """
    from app.models.case import DepartmentTask
    assigned_task = (
        db.query(DepartmentTask)
        .filter(
            DepartmentTask.case_id == case_id,
            DepartmentTask.assigned_verifier_id == str(user.id),
        )
        .first()
    )
    if assigned_task is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned as verifier for this case",
        )

    findings_list = [f.model_dump() for f in dto.findings]
    result = service.submit_verifier_findings(
        db,
        case_id=str(case_id),
        verifier_id=str(user.id),
        findings=findings_list,
        overall_finding=dto.overall_finding,
        declaration_confirmed=dto.declaration_confirmed,
        task_id=str(dto.task_id) if dto.task_id else str(assigned_task.id),
        notes=dto.notes,
    )
    if isinstance(result, str):
        if result == service.CASE_NOT_FOUND:
            raise _not_found_case(case_id)
        if result == service.FORBIDDEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Declaration must be confirmed to submit findings",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    return result
