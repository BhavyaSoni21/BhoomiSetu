"""Ported from backend/src/workflows/workflows.controller.ts.

create() now requires a signed-in CITIZEN - filing a request is
account-gated. Everything else here is officer/admin-only. Accepts
either multipart/form-data (an optional 'document' evidence file, plus
the same fields as form values) or a plain JSON body, mirroring the
original's FileInterceptor-only-activates-for-multipart behavior -
FastAPI can't bind both a Pydantic JSON body and Form()/File() params on
one endpoint, so this reads the raw request and branches on Content-Type
instead, validating either shape through the same CreateWorkflow schema.
"""

import uuid
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.auth.deps import require_roles
from app.auth.roles import ALL_STAFF_ROLES, CITIZEN_ROLE, ROLE_DEPARTMENT, VERIFIER_ROLE
from app.common.supabase_storage import upload_to_storage
from app.database import get_db
from app.document_verification.authenticity import check_authenticity
from app.document_verification.ocr import extract_text
from app.models.user import User
from app.schemas.workflow import (
    AssignVerifier, CreateWorkflow, EscalateWorkflowStep, FieldEvidenceOut, ReopenWorkflowStep, ReviewWorkflowStep, UpdateWorkflowStatus, WorkflowOut,
)
from app.services import audit_service
from app.services import workflows_service as service
from app.services.workflows_service import CreateWorkflowInput, FieldEvidenceInput, WorkflowEvidenceInput

router = APIRouter(prefix="/workflows", tags=["workflows"])

_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB, matching the old document-verification controller's own limit

# KNOWN_RISKS.md HIGH-4: the stored file's extension must never come
# straight from the client-supplied Content-Type subtype - an allowlist
# keyed off it instead.
_IMAGE_EXTENSIONS_BY_SUBTYPE = {"png": "png", "jpeg": "jpg", "jpg": "jpg", "webp": "webp"}


def _not_found_workflow(workflow_id) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow not found: {workflow_id}")


def _not_found_step(step_id) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow step not found: {step_id}")


@router.post("", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
async def create(request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(CITIZEN_ROLE))):
    content_type = request.headers.get("content-type", "")
    file: UploadFile | None = None
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        body = {}
        # request.form() returns Starlette's own UploadFile for a file part
        # (not fastapi.UploadFile, a subclass never instantiated here) -
        # isinstance against the fastapi one silently missed every upload,
        # so the 'document' branch below never ran. Found live: a citizen's
        # evidence upload always came back with evidenceFileName null.
        for key, value in form.multi_items():
            if isinstance(value, StarletteUploadFile):
                if key == "document" and value.filename:
                    file = value
            else:
                body[key] = value
    else:
        body = await request.json()

    try:
        dto = CreateWorkflow.model_validate(body)
    except ValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error.errors()) from error

    # Raise Request restricted to the citizen's own parcels. Existence is
    # checked before association so a bogus parcel id still gets a 400
    # rather than being swallowed into a 403.
    if not service.parcel_exists(db, str(dto.parcel_id)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Parcel not found: {dto.parcel_id}")

    # LAND_CLAIM_REQUEST and DISPUTE_FILING are the two exceptions to the
    # association check below - claiming is precisely for a parcel the
    # citizen ISN'T yet linked to, and a dispute is definitionally often
    # about a parcel they don't hold either.
    if dto.workflow_type == "LAND_CLAIM_REQUEST":
        if service.has_conflicting_claim(db, str(dto.parcel_id)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This parcel is already linked to another account. If you believe this is incorrect, file a dispute instead.",
            )
    elif dto.workflow_type != "DISPUTE_FILING":
        if not service.is_citizen_associated_with_parcel(db, str(user.id), str(dto.parcel_id)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only raise a request for a parcel associated with your account")

    evidence: WorkflowEvidenceInput | None = None
    if file is not None:
        content_type_header = file.content_type or ""
        subtype = content_type_header[len("image/"):] if content_type_header.startswith("image/") else None
        extension = _IMAGE_EXTENSIONS_BY_SUBTYPE.get(subtype) if subtype else None
        if extension is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The attached document must be an image (png, jpg, or webp)")
        data = await file.read()
        if len(data) > _MAX_IMAGE_BYTES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The attached document must be 5MB or smaller")
        ocr_result = extract_text(data)
        authenticity_result = check_authenticity(data)
        file_name = f"{uuid.uuid4()}.{extension}"
        file_path = f"workflow-evidence/{file_name}"
        upload_to_storage(file_path, data, content_type_header)
        evidence = WorkflowEvidenceInput(
            file_name=file_name, file_path=file_path, mime_type=content_type_header, extracted_text=ocr_result.text,
            authenticity_suspicious=authenticity_result.suspicious, authenticity_reasons=authenticity_result.reasons,
        )

    # Simplified Raise Request: applicant contact/address snapshotted from
    # the citizen's own profile, never client-entered - whichever contact
    # method is actually verified.
    applicant_contact = user.mobile_number if user.mobile_verified else (user.email if user.email_verified else None)
    result = service.create(
        db,
        CreateWorkflowInput(
            parcel_id=str(dto.parcel_id), workflow_type=dto.workflow_type, created_by=dto.created_by or user.name,
            request_details=dto.request_details, citizen_id=str(user.id), applicant_contact=applicant_contact,
            applicant_address=user.address, evidence=evidence,
        ),
    )
    if result == service.PARCEL_NOT_FOUND:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Parcel not found: {dto.parcel_id}")

    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="WORKFLOW_CREATED", entity_type="WORKFLOW",
        entity_id=str(result.id), parcel_id=result.parcel_id, metadata={"workflowType": result.workflow_type},
    )
    return result


@router.get("", response_model=list[WorkflowOut])
def find_all(
    department: str | None = None, step_status: str | None = Query(None, alias="stepStatus"), limit: int | None = None, offset: int | None = None,
    db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    # An officer only ever gets their own department's queue, regardless of
    # what a client sends - only ADMIN may query across departments (or
    # narrow to a specific one via the query param).
    scoped_department = department if user.role == "ADMIN" else ROLE_DEPARTMENT.get(user.role)
    return service.find_all(db, scoped_department, step_status, limit, offset)


# Registered before '/{id}' so 'mine' is never swallowed as an id param.
@router.get("/mine", response_model=list[WorkflowOut])
def find_mine(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), user: User = Depends(require_roles(CITIZEN_ROLE))):
    return service.find_mine_for_citizen(db, str(user.id), skip, limit)


# Same registration-order reason as '/mine' above.
@router.get("/assigned-to-me", response_model=list[WorkflowOut])
def find_assigned_to_me(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), user: User = Depends(require_roles(VERIFIER_ROLE))):
    return service.find_assigned_to_verifier(db, str(user.id), skip, limit)


# Department-scoped like GET /workflows above (KNOWN_RISKS.md HIGH-9) - a
# non-ADMIN caller with no step in their own department gets the same 404
# as a nonexistent id, rather than a 403 that would confirm the id exists.
@router.get("/{id}", response_model=WorkflowOut)
def find_one(id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    workflow = service.find_one(db, str(id))
    if workflow is None:
        raise _not_found_workflow(id)
    if user.role != "ADMIN":
        own_department = ROLE_DEPARTMENT.get(user.role)
        if not any(step.department == own_department for step in workflow.steps):
            raise _not_found_workflow(id)
    return workflow


# Serves a citizen-submitted evidence file - staff-only.
@router.get("/{id}/evidence")
def get_evidence(id: UUID, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    file = service.get_evidence_file(db, str(id))
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No evidence file found for workflow: {id}")
    data, mime_type = file
    return Response(content=data, media_type=mime_type)


@router.patch("/{id}/status", response_model=WorkflowOut)
def update_status(id: UUID, dto: UpdateWorkflowStatus, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    workflow = service.update_status(db, str(id), dto.status, dto.remarks)
    if workflow is None:
        raise _not_found_workflow(id)
    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="WORKFLOW_STATUS_CHANGED", entity_type="WORKFLOW",
        entity_id=str(id), parcel_id=workflow.parcel_id, metadata={"status": dto.status, "remarks": dto.remarks},
    )
    return workflow


@router.patch("/{workflow_id}/steps/{step_id}", response_model=WorkflowOut)
def review_step(workflow_id: UUID, step_id: UUID, dto: ReviewWorkflowStep, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    result = service.review_step(db, str(workflow_id), str(step_id), dto.action, dto.remarks, user.role)
    if result == service.WORKFLOW_NOT_FOUND:
        raise _not_found_workflow(workflow_id)
    if result == service.STEP_NOT_FOUND:
        raise _not_found_step(step_id)
    if result == service.FORBIDDEN_WRONG_DEPARTMENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This workflow step is not assigned to your role")
    if result == service.STEP_ALREADY_DECIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This workflow step has already been decided")
    if result == service.CLAIM_CONFLICT:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This parcel was linked to another account before this claim could be approved. Direct the citizen to file a dispute instead.")

    decided_step = next(s for s in result.steps if str(s.id) == str(step_id))
    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="WORKFLOW_STEP_APPROVED" if decided_step.action == "APPROVE" else "WORKFLOW_STEP_REJECTED",
        entity_type="WORKFLOW_STEP", entity_id=str(step_id), parcel_id=result.parcel_id,
        metadata={"workflowId": str(workflow_id), "department": decided_step.department, "remarks": decided_step.remarks},
    )
    return result


# Admin oversight "alert the officers" action - ADMIN-only.
@router.post("/{workflow_id}/steps/{step_id}/escalate", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
def escalate_step(workflow_id: UUID, step_id: UUID, dto: EscalateWorkflowStep, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    result = service.escalate_step(db, str(workflow_id), str(step_id), dto.message)
    if result == service.WORKFLOW_NOT_FOUND:
        raise _not_found_workflow(workflow_id)
    if result == service.STEP_NOT_FOUND:
        raise _not_found_step(step_id)
    if result == service.STEP_ALREADY_DECIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This workflow step has already been decided - nothing to escalate")

    escalated_step = next(s for s in result.steps if str(s.id) == str(step_id))
    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="WORKFLOW_STEP_ESCALATED", entity_type="WORKFLOW_STEP",
        entity_id=str(step_id), parcel_id=result.parcel_id, metadata={"workflowId": str(workflow_id), "department": escalated_step.department, "message": dto.message},
    )
    return result


# Admin oversight "send back for re-review" action - ADMIN-only.
@router.post("/{workflow_id}/steps/{step_id}/reopen", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
def reopen_step(workflow_id: UUID, step_id: UUID, dto: ReopenWorkflowStep, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    result = service.reopen_step(db, str(workflow_id), str(step_id), dto.message)
    if result == service.WORKFLOW_NOT_FOUND:
        raise _not_found_workflow(workflow_id)
    if result == service.STEP_NOT_FOUND:
        raise _not_found_step(step_id)
    if result == service.STEP_NOT_DECIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This workflow step has not been decided yet - nothing to send back for re-review")

    reopened_step = next(s for s in result.steps if str(s.id) == str(step_id))
    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="WORKFLOW_STEP_REOPENED", entity_type="WORKFLOW_STEP",
        entity_id=str(step_id), parcel_id=result.parcel_id, metadata={"workflowId": str(workflow_id), "department": reopened_step.department, "message": dto.message},
    )
    return result


# Admin-only, same as the rest of staff account/assignment management
# (see users_service.find_all's docstring) - hands a workflow off to an
# Authorized Field Verifier.
@router.patch("/{id}/assign-verifier", response_model=WorkflowOut)
def assign_verifier(id: UUID, dto: AssignVerifier, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN"))):
    result = service.assign_verifier(db, str(id), str(dto.verifier_id))
    if result == service.WORKFLOW_NOT_FOUND:
        raise _not_found_workflow(id)
    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="WORKFLOW_VERIFIER_ASSIGNED", entity_type="WORKFLOW",
        entity_id=str(id), parcel_id=result.parcel_id, metadata={"verifierId": str(dto.verifier_id)},
    )
    return result


@router.post("/{id}/field-evidence", response_model=FieldEvidenceOut, status_code=status.HTTP_201_CREATED)
async def add_field_evidence(
    id: UUID,
    photo: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    captured_at: datetime = Form(..., alias="capturedAt"),
    notes: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(VERIFIER_ROLE)),
):
    # Same image-extension allowlist/size cap as the citizen evidence
    # upload in create() above (KNOWN_RISKS.md HIGH-4: never trust the
    # client-supplied Content-Type subtype for the stored extension).
    content_type_header = photo.content_type or ""
    subtype = content_type_header[len("image/"):] if content_type_header.startswith("image/") else None
    extension = _IMAGE_EXTENSIONS_BY_SUBTYPE.get(subtype) if subtype else None
    if extension is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The field-evidence photo must be an image (png, jpg, or webp)")
    data = await photo.read()
    if len(data) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The field-evidence photo must be 5MB or smaller")

    file_name = f"{uuid.uuid4()}.{extension}"
    file_path = f"verification-evidence/{file_name}"
    upload_to_storage(file_path, data, content_type_header)

    result = service.add_field_evidence(
        db, str(id), str(user.id),
        FieldEvidenceInput(
            file_name=file_name, file_path=file_path, mime_type=content_type_header,
            latitude=latitude, longitude=longitude, captured_at=captured_at, notes=notes,
        ),
    )
    if result == service.WORKFLOW_NOT_FOUND:
        raise _not_found_workflow(id)
    if result == service.NOT_ASSIGNED_TO_YOU:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This workflow is not assigned to you")

    audit_service.log(
        db, user_id=str(user.id), user_role=user.role, action="FIELD_EVIDENCE_SUBMITTED", entity_type="WORKFLOW",
        entity_id=str(id), metadata={"evidenceId": str(result.id)},
    )
    return result


@router.get("/{id}/field-evidence", response_model=list[FieldEvidenceOut])
def get_field_evidence(id: UUID, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    return service.list_field_evidence(db, str(id))


@router.get("/{id}/field-evidence/{evidence_id}/photo")
def get_field_evidence_photo(id: UUID, evidence_id: UUID, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    file = service.get_field_evidence_photo(db, str(id), str(evidence_id))
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No field-evidence photo found: {evidence_id}")
    data, mime_type = file
    return Response(content=data, media_type=mime_type)
