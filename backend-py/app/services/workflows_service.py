"""Ported from backend/src/workflows/workflows.service.ts."""

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.common.pagination import resolve_pagination
from app.common.supabase_storage import download_from_storage
from app.document_verification.field_matcher import text_contains_approx_number, text_contains_identifier, text_contains_name
from app.models.parcel import CitizenParcel, Parcel, ParcelDocument
from app.models.user import User
from app.models.verification_evidence import VerificationEvidence
from app.models.workflow import Workflow, WorkflowStep
from app.services import notification_feed_service, pipeline_config_service, request_routing_service
from app.services.notification_feed_service import NotificationPayload

VERIFICATION_WORKFLOW_TYPES = {"LAND_CLAIM_REQUEST", "DOCUMENT_VERIFICATION_REQUEST"}

PARCEL_NOT_FOUND = "PARCEL_NOT_FOUND"
WORKFLOW_NOT_FOUND = "WORKFLOW_NOT_FOUND"
STEP_NOT_FOUND = "STEP_NOT_FOUND"
STEP_ALREADY_DECIDED = "STEP_ALREADY_DECIDED"
STEP_NOT_DECIDED = "STEP_NOT_DECIDED"
FORBIDDEN_WRONG_DEPARTMENT = "FORBIDDEN_WRONG_DEPARTMENT"
CLAIM_CONFLICT = "CLAIM_CONFLICT"
NOT_ASSIGNED_TO_YOU = "NOT_ASSIGNED_TO_YOU"


def _pipeline_for(db: Session, workflow_type: str) -> list[request_routing_service.PipelineStage]:
    """Get pipeline stages from DB config, falling back to hardcoded defaults."""
    return pipeline_config_service.get_pipeline_stages_for_workflow_type(db, workflow_type)


@dataclass
class WorkflowEvidenceInput:
    file_name: str
    file_path: str
    mime_type: str
    extracted_text: str | None
    authenticity_suspicious: bool = False
    authenticity_reasons: list[str] | None = None


@dataclass
class FieldEvidenceInput:
    file_name: str
    file_path: str
    mime_type: str
    latitude: float
    longitude: float
    captured_at: datetime
    notes: str | None


@dataclass
class CreateWorkflowInput:
    parcel_id: str
    workflow_type: str
    created_by: str | None = None
    request_details: str | None = None
    citizen_id: str | None = None
    applicant_contact: str | None = None
    applicant_address: str | None = None
    evidence: WorkflowEvidenceInput | None = None


def _with_steps(stmt):
    return stmt.options(selectinload(Workflow.steps))


# Land Claim conflict check: a parcel already linked to ANY citizen -
# including, in principle, the same one filing again - can't be claimed a
# second time; the citizen is pointed at the existing Dispute Filing flow
# instead of a new conflict-tracking subsystem. Re-checked at review time
# too (review_step), since a conflict could appear between filing and
# decision.
def has_conflicting_claim(db: Session, parcel_id: str) -> bool:
    return db.scalars(select(CitizenParcel).where(CitizenParcel.parcel_id == parcel_id)).first() is not None


def parcel_exists(db: Session, parcel_id: str) -> bool:
    return db.get(Parcel, parcel_id) is not None


def is_citizen_associated_with_parcel(db: Session, citizen_id: str, parcel_id: str) -> bool:
    return db.scalars(select(CitizenParcel).where(CitizenParcel.citizen_id == citizen_id, CitizenParcel.parcel_id == parcel_id)).first() is not None


def find_mine_for_citizen(db: Session, citizen_id: str) -> list[Workflow]:
    parcel_ids = [row.parcel_id for row in db.scalars(select(CitizenParcel).where(CitizenParcel.citizen_id == citizen_id)).all()]
    if not parcel_ids:
        return []

    take, skip = resolve_pagination()
    stmt = _with_steps(select(Workflow).where(Workflow.parcel_id.in_([str(pid) for pid in parcel_ids])).order_by(Workflow.created_at.desc()).limit(take).offset(skip))
    return list(db.scalars(stmt).unique().all())


def create(db: Session, dto: CreateWorkflowInput) -> Workflow | str:
    parcel = db.get(Parcel, dto.parcel_id)
    if parcel is None:
        return PARCEL_NOT_FOUND

    # AI-based routing is the primary mechanism when it returns a valid
    # result; the deterministic _pipeline_for() is the guaranteed fallback.
    routing = request_routing_service.suggest_pipeline(dto.workflow_type, dto.request_details)
    pipeline = routing.pipeline if routing.pipeline else _pipeline_for(db, dto.workflow_type)

    # Evidence's own OCR text is preferred (the citizen just submitted it
    # specifically for this request); an existing ParcelDocument is the
    # fallback. Whichever it is, the pre-check itself is unchanged.
    verification_precheck: str | None = None
    if dto.workflow_type in VERIFICATION_WORKFLOW_TYPES:
        existing_document = None if dto.evidence else db.scalars(select(ParcelDocument).where(ParcelDocument.parcel_id == dto.parcel_id)).first()
        ocr_text = (dto.evidence.extracted_text if dto.evidence else None) or (existing_document.extracted_text if existing_document else None)
        verification_precheck = _build_verification_precheck(parcel, dto.created_by or "Applicant", ocr_text)

    workflow = Workflow(
        parcel_id=dto.parcel_id,
        workflow_type=dto.workflow_type,
        created_by=dto.created_by,
        request_details=dto.request_details,
        current_status="SUBMITTED",
        routing_notes=routing.routing_notes if routing.pipeline else None,
        citizen_id=dto.citizen_id,
        applicant_contact=dto.applicant_contact,
        applicant_address=dto.applicant_address,
        verification_precheck=verification_precheck,
        evidence_file_name=dto.evidence.file_name if dto.evidence else None,
        evidence_file_path=dto.evidence.file_path if dto.evidence else None,
        evidence_mime_type=dto.evidence.mime_type if dto.evidence else None,
        evidence_extracted_text=dto.evidence.extracted_text if dto.evidence else None,
        evidence_authenticity_suspicious=dto.evidence.authenticity_suspicious if dto.evidence else None,
        evidence_authenticity_reasons=json.dumps(dto.evidence.authenticity_reasons) if dto.evidence and dto.evidence.authenticity_reasons else None,
    )
    db.add(workflow)
    db.flush()

    db.add_all([
        WorkflowStep(workflow_id=workflow.id, step_order=index + 1, department=stage.department, assigned_role=stage.assigned_role, status="PENDING")
        for index, stage in enumerate(pipeline)
    ])
    db.flush()

    _notify_assigned_officers(db, workflow, pipeline)

    return find_one(db, str(workflow.id))


# New-request notification - every officer holding one of the pipeline's
# assigned roles gets their own notification row, not a shared broadcast.
# Jurisdiction-aware: notifies officers in the same district as the parcel,
# plus officers with no district assigned (central/unassigned officers).
def _notify_assigned_officers(db: Session, workflow: Workflow, pipeline: list[request_routing_service.PipelineStage]) -> None:
    roles = list(dict.fromkeys(stage.assigned_role for stage in pipeline))
    if not roles:
        return

    parcel = db.get(Parcel, workflow.parcel_id)
    if parcel is None:
        return

    # Include officers in the parcel's district AND officers with no district (central)
    officers = list(db.scalars(
        select(User).where(
            User.role.in_(roles),
            (User.district == parcel.district_code) | (User.district.is_(None))
        )
    ).all())
    if not officers:
        return

    departments = ", ".join(stage.department for stage in pipeline)
    message = (
        f"A new request needs your department's review ({departments}). {workflow.routing_notes}"
        if workflow.routing_notes
        else f"A new request needs your department's review ({departments})."
    )
    notification_feed_service.notify_users(
        db, [str(officer.id) for officer in officers],
        NotificationPayload(type="WORKFLOW_ASSIGNED", title=f"New {workflow.workflow_type.replace('_', ' ').lower()} request", message=message, parcel_id=workflow.parcel_id, workflow_id=str(workflow.id)),
        deliver=True,
    )


# Automatic OCR pre-check - reuses the OCR/field-matcher code against the
# applicant's own name, the parcel's area, and its ULPIN if it has one.
# Shown to the officer as an aid; the officer's decision is what actually
# counts, not this match. Returns a JSON string (Workflow.verification_precheck
# is a plain text column) - NO_DOCUMENT_ON_FILE when there's no text at all,
# not the same as a MISMATCH.
def _build_verification_precheck(parcel: Parcel, applicant_name: str, extracted_text: str | None) -> str:
    if not extracted_text:
        return json.dumps({"verdict": "NO_DOCUMENT_ON_FILE", "checks": []})

    checks = [
        {"field": "OWNER_NAME", "expectedValue": applicant_name, "status": "MATCHED" if text_contains_name(extracted_text, applicant_name) else "MISMATCH"},
        {"field": "AREA", "expectedValue": f"{parcel.area_sq_m} sqm", "status": "MATCHED" if text_contains_approx_number(extracted_text, float(parcel.area_sq_m)) else "MISMATCH"},
    ]
    if parcel.ulpin:
        checks.append({"field": "ULPIN", "expectedValue": parcel.ulpin, "status": "MATCHED" if text_contains_identifier(extracted_text, parcel.ulpin) else "MISMATCH"})

    matched_count = sum(1 for c in checks if c["status"] == "MATCHED")
    verdict = "MATCHED" if matched_count == len(checks) else "MISMATCH" if matched_count == 0 else "PARTIAL_MATCH"
    return json.dumps({"verdict": verdict, "checks": checks})


# The real, visible payoff of an officer's approval - not just a status
# label on the workflow itself. When the approved workflow carried
# freshly-submitted evidence, that evidence IS promoted into becoming the
# parcel's official ParcelDocument - overwriting whatever was there, since
# this is a fresh submission specifically for this approval. Otherwise
# keeps the original behavior: flip an existing document to REGISTERED, or
# create a bare row with no image on disk if the parcel had nothing at all.
def _mark_parcel_document_registered(db: Session, parcel_id: str, fresh_evidence: WorkflowEvidenceInput | None) -> None:
    document = db.scalars(select(ParcelDocument).where(ParcelDocument.parcel_id == parcel_id)).first()

    if fresh_evidence:
        if document is None:
            document = ParcelDocument(parcel_id=parcel_id, document_type="ROR_COPY")
            db.add(document)
        document.file_name = fresh_evidence.file_name
        document.file_path = fresh_evidence.file_path
        document.mime_type = fresh_evidence.mime_type
        document.extracted_text = fresh_evidence.extracted_text
        document.registration_status = "REGISTERED"
        db.flush()
        return

    if document:
        if document.registration_status != "REGISTERED":
            document.registration_status = "REGISTERED"
            db.flush()
        return

    db.add(ParcelDocument(parcel_id=parcel_id, document_type="ROR_COPY", file_name="", file_path="", mime_type="image/png", extracted_text=None, registration_status="REGISTERED"))
    db.flush()


def get_evidence_file(db: Session, workflow_id: str) -> tuple[bytes, str] | None:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None or not workflow.evidence_file_path:
        return None
    try:
        return download_from_storage(workflow.evidence_file_path), workflow.evidence_mime_type or "image/png"
    except Exception:  # noqa: BLE001 - a missing/unreadable file means "no evidence available", not a 500
        return None


def find_one(db: Session, workflow_id: str) -> Workflow | None:
    stmt = _with_steps(select(Workflow).where(Workflow.id == workflow_id))
    return db.scalars(stmt).unique().first()


# Officer dashboard listing: every workflow, optionally narrowed to ones
# with a step matching a given department and/or step status - i.e.
# "workflows where my department's review is still pending".
#
# KNOWN_RISKS.md HIGH-6: limit/offset are applied to the filtered result,
# not the initial fetch - capping the initial DB fetch before filtering
# would risk silently truncating a department's own queue.
def find_all(db: Session, department: str | None = None, step_status: str | None = None, limit: int | None = None, offset: int | None = None) -> list[Workflow]:
    stmt = _with_steps(select(Workflow).order_by(Workflow.created_at.desc()))
    workflows = list(db.scalars(stmt).unique().all())

    if department or step_status:
        workflows = [
            w for w in workflows
            if any((not department or step.department == department) and (not step_status or step.status == step_status) for step in w.steps)
        ]

    take, skip = resolve_pagination(limit, offset)
    return workflows[skip : skip + take]


def find_by_parcel(db: Session, parcel_id: str) -> list[Workflow]:
    take, skip = resolve_pagination()
    stmt = _with_steps(select(Workflow).where(Workflow.parcel_id == parcel_id).order_by(Workflow.created_at.desc()).limit(take).offset(skip))
    return list(db.scalars(stmt).unique().all())


def assign_verifier(db: Session, workflow_id: str, verifier_id: str) -> Workflow | str:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        return WORKFLOW_NOT_FOUND
    workflow.assigned_verifier_id = verifier_id
    db.flush()
    return workflow


def find_assigned_to_verifier(db: Session, verifier_id: str) -> list[Workflow]:
    take, skip = resolve_pagination()
    stmt = _with_steps(
        select(Workflow).where(Workflow.assigned_verifier_id == verifier_id).order_by(Workflow.created_at.desc()).limit(take).offset(skip)
    )
    return list(db.scalars(stmt).unique().all())


def add_field_evidence(db: Session, workflow_id: str, verifier_id: str, evidence: FieldEvidenceInput) -> VerificationEvidence | str:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        return WORKFLOW_NOT_FOUND
    # A Verifier may only submit evidence for a case actually assigned to
    # them - the one check standing between "authorized field verifier" and
    # "anyone with a Verifier account can attach evidence to any request".
    if workflow.assigned_verifier_id != verifier_id:
        return NOT_ASSIGNED_TO_YOU

    row = VerificationEvidence(
        workflow_id=workflow_id, verifier_id=verifier_id,
        photo_file_name=evidence.file_name, photo_file_path=evidence.file_path, mime_type=evidence.mime_type,
        latitude=evidence.latitude, longitude=evidence.longitude, captured_at=evidence.captured_at, notes=evidence.notes,
    )
    db.add(row)
    db.flush()
    return row


def list_field_evidence(db: Session, workflow_id: str) -> list[VerificationEvidence]:
    stmt = select(VerificationEvidence).where(VerificationEvidence.workflow_id == workflow_id).order_by(VerificationEvidence.captured_at.desc())
    return list(db.scalars(stmt).all())


def get_field_evidence_photo(db: Session, workflow_id: str, evidence_id: str) -> tuple[bytes, str] | None:
    row = db.get(VerificationEvidence, evidence_id)
    if row is None or str(row.workflow_id) != str(workflow_id):
        return None
    try:
        return download_from_storage(row.photo_file_path), row.mime_type
    except Exception:  # noqa: BLE001 - a missing/unreadable file means "no evidence available", not a 500
        return None


def update_status(db: Session, workflow_id: str, status: str, remarks: str | None) -> Workflow | None:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        return None
    workflow.current_status = status
    if remarks is not None:
        workflow.last_remarks = remarks
    db.flush()
    return find_one(db, workflow_id)


def _recompute_workflow_status(steps: list[WorkflowStep]) -> str:
    if any(s.status == "REJECTED" for s in steps):
        return "REJECTED"
    if all(s.status == "APPROVED" for s in steps):
        return "APPROVED"
    return "IN_PROGRESS"


# The actual officer review action: approve/reject ONE workflow_steps row,
# then recompute the workflow's overall current_status from every step's
# outcome - any REJECTED step rejects the whole workflow, all APPROVED
# steps approves it, otherwise it's IN_PROGRESS. A step can only be
# decided once (PENDING -> APPROVED/REJECTED).
def review_step(db: Session, workflow_id: str, step_id: str, action: str, remarks: str, acting_user_role: str) -> Workflow | str:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        return WORKFLOW_NOT_FOUND

    step = db.scalars(select(WorkflowStep).where(WorkflowStep.id == step_id, WorkflowStep.workflow_id == workflow_id)).first()
    if step is None:
        return STEP_NOT_FOUND
    # ADMIN can decide any step regardless of department; every officer
    # role may only decide the step assigned to their own role.
    if acting_user_role != "ADMIN" and step.assigned_role != acting_user_role:
        return FORBIDDEN_WRONG_DEPARTMENT
    if step.status != "PENDING":
        return STEP_ALREADY_DECIDED

    # Re-checked here (also checked at filing time) - a conflict could
    # appear between filing and this decision. LAND_CLAIM_REQUEST's
    # pipeline is always exactly one step, so "approve this step" and
    # "approve the whole claim" are the same event.
    if action == "APPROVE" and workflow.workflow_type == "LAND_CLAIM_REQUEST" and has_conflicting_claim(db, workflow.parcel_id):
        return CLAIM_CONFLICT

    step.status = "APPROVED" if action == "APPROVE" else "REJECTED"
    step.action = action
    step.remarks = remarks
    step.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()

    all_steps = list(db.scalars(select(WorkflowStep).where(WorkflowStep.workflow_id == workflow_id)).all())
    workflow.current_status = _recompute_workflow_status(all_steps)
    db.flush()

    # The real, visible payoff of an approval - only reachable once the
    # whole workflow is APPROVED, which for these two single-step
    # pipelines means exactly this step.
    if action == "APPROVE" and workflow.current_status == "APPROVED":
        if workflow.workflow_type in ("LAND_CLAIM_REQUEST", "DOCUMENT_VERIFICATION_REQUEST") and workflow.citizen_id:
            citizen_link = db.scalars(select(CitizenParcel).where(
                CitizenParcel.citizen_id == workflow.citizen_id,
                CitizenParcel.parcel_id == workflow.parcel_id,
            )).first()
            if citizen_link:
                citizen_link.status = "Registered"
            else:
                db.add(CitizenParcel(citizen_id=workflow.citizen_id, parcel_id=workflow.parcel_id, status="Registered"))
            db.flush()
        if workflow.workflow_type in VERIFICATION_WORKFLOW_TYPES:
            fresh_evidence = (
                WorkflowEvidenceInput(file_name=workflow.evidence_file_name, file_path=workflow.evidence_file_path, mime_type=workflow.evidence_mime_type, extracted_text=workflow.evidence_extracted_text)
                if workflow.evidence_file_path
                else None
            )
            _mark_parcel_document_registered(db, workflow.parcel_id, fresh_evidence)
    elif action == "REJECT":
        if workflow.workflow_type in ("LAND_CLAIM_REQUEST", "DOCUMENT_VERIFICATION_REQUEST") and workflow.citizen_id:
            citizen_link = db.scalars(select(CitizenParcel).where(
                CitizenParcel.citizen_id == workflow.citizen_id,
                CitizenParcel.parcel_id == workflow.parcel_id,
            )).first()
            if citizen_link:
                citizen_link.status = "Rejected"
                db.flush()

    _notify_citizen_of_step_decision(db, workflow, step)

    return find_one(db, workflow_id)


# Admin oversight "alert the officers" action: an Admin is not expected to
# decide a pending step by default - this notifies whoever holds the
# step's assigned_role to prioritize it, without touching step.status/
# action at all. Jurisdiction-aware: notifies officers in the parcel's district plus central officers.
def escalate_step(db: Session, workflow_id: str, step_id: str, message: str) -> Workflow | str:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        return WORKFLOW_NOT_FOUND

    step = db.scalars(select(WorkflowStep).where(WorkflowStep.id == step_id, WorkflowStep.workflow_id == workflow_id)).first()
    if step is None:
        return STEP_NOT_FOUND
    if step.status != "PENDING":
        return STEP_ALREADY_DECIDED

    parcel = db.get(Parcel, workflow.parcel_id)
    if parcel is None:
        return find_one(db, workflow_id)

    # Include officers in the parcel's district AND officers with no district (central)
    officers = list(db.scalars(
        select(User).where(
            User.role == step.assigned_role,
            (User.district == parcel.district_code) | (User.district.is_(None))
        )
    ).all())
    notification_feed_service.notify_users(
        db, [str(officer.id) for officer in officers],
        NotificationPayload(
            type="ADMIN_ESCALATION",
            title=f"Admin flagged this {_strip_request_suffix(workflow.workflow_type)} request for urgent review",
            message=message, parcel_id=workflow.parcel_id, workflow_id=str(workflow.id),
        ),
        deliver=True,
    )
    return find_one(db, workflow_id)


# Admin oversight "send back for re-review" action - the inverse of
# review_step above: resets an already-decided step (APPROVED/REJECTED)
# back to PENDING so the responsible officer has to look at it again and
# decide fresh. Jurisdiction-aware: notifies officers in the parcel's district plus central officers.
def reopen_step(db: Session, workflow_id: str, step_id: str, message: str) -> Workflow | str:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        return WORKFLOW_NOT_FOUND

    step = db.scalars(select(WorkflowStep).where(WorkflowStep.id == step_id, WorkflowStep.workflow_id == workflow_id)).first()
    if step is None:
        return STEP_NOT_FOUND
    if step.status == "PENDING":
        return STEP_NOT_DECIDED

    step.status = "PENDING"
    step.action = None
    step.remarks = None
    step.completed_at = None
    db.flush()

    all_steps = list(db.scalars(select(WorkflowStep).where(WorkflowStep.workflow_id == workflow_id)).all())
    workflow.current_status = _recompute_workflow_status(all_steps)
    db.flush()

    parcel = db.get(Parcel, workflow.parcel_id)
    if parcel is None:
        return find_one(db, workflow_id)

    # Include officers in the parcel's district AND officers with no district (central)
    officers = list(db.scalars(
        select(User).where(
            User.role == step.assigned_role,
            (User.district == parcel.district_code) | (User.district.is_(None))
        )
    ).all())
    notification_feed_service.notify_users(
        db, [str(officer.id) for officer in officers],
        NotificationPayload(
            type="ADMIN_REOPENED_STEP",
            title=f"Admin sent this {_strip_request_suffix(workflow.workflow_type)} request back for re-review",
            message=message, parcel_id=workflow.parcel_id, workflow_id=str(workflow.id),
        ),
        deliver=True,
    )
    return find_one(db, workflow_id)


def _strip_request_suffix(workflow_type: str) -> str:
    stripped = workflow_type[: -len("_REQUEST")] if workflow_type.endswith("_REQUEST") else workflow_type
    return stripped.replace("_", " ").lower()


# Step-decision notification, the "vice versa" direction of
# _notify_assigned_officers above. Resolved directly via workflow.citizen_id
# (set once at creation) rather than a citizen_parcels-join lookup, which
# can't work for a LAND_CLAIM_REQUEST at all (no link exists until this
# very decision creates one, above).
def _notify_citizen_of_step_decision(db: Session, workflow: Workflow, step: WorkflowStep) -> None:
    if not workflow.citizen_id:
        return

    verb = "approved" if step.action == "APPROVE" else "rejected"
    message = f"{step.department.replace('_', ' ')} {verb} your request. {step.remarks}" if step.remarks else f"{step.department.replace('_', ' ')} {verb} your request."
    notification_feed_service.notify_users(
        db, [workflow.citizen_id],
        NotificationPayload(type="WORKFLOW_STEP_APPROVED" if step.action == "APPROVE" else "WORKFLOW_STEP_REJECTED", title=f"Your request was {verb}", message=message, parcel_id=workflow.parcel_id, workflow_id=str(workflow.id)),
        deliver=True,
    )
