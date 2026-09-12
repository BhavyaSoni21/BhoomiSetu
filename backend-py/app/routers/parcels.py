"""Ported from backend/src/parcels/parcels.controller.ts.

All four originally-stubbed endpoints (`/360`, `/workflows`, `/risk-score`,
`/audit`) are now wired for real - `/workflows` was the last, once
WorkflowsModule was built. PYTHON_MIGRATION_PLAN.md §4 already flags
ParcelsModule as "the first module whose own tests need those modules to
already exist" - rather than block this whole module on building all
four up front, everything ParcelsService itself could do stood on its
own from the start, and each stub was wired for real once its module
landed.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user_optional, require_roles
from app.auth.roles import ALL_STAFF_ROLES, CITIZEN_ROLE
from app.database import get_db
from app.models.user import User
from app.schemas.audit import AuditLogOut
from app.schemas.interoperability import parcel_360_to_json
from app.schemas.parcel import ParcelOut
from app.schemas.parcels_extra import (
    IdentifyFromDocumentResponse,
    OwnershipHistoryRecordOut,
    ParcelDocumentOut,
    ParcelHistoricalStateOut,
    SearchParcelsResponse,
)
from app.schemas.predictive_analytics import RiskScoreOut
from app.schemas.workflow import WorkflowOut
from app.services import audit_service
from app.services import parcel_access
from app.services import parcels_service as service
from app.services import predictive_analytics_service
from app.services import response_aggregator_service
from app.services import workflows_service

router = APIRouter(prefix="/parcels", tags=["parcels"])

_MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _not_found(parcel_id) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Parcel not found with id: {parcel_id}")


@router.get("", response_model=SearchParcelsResponse)
def search_parcels(
    ulpin: str | None = None,
    survey_number: str | None = None,
    plot_number: str | None = None,
    local_identifier: str | None = None,
    state: str | None = None,
    district: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
    db: Session = Depends(get_db),
):
    return service.search_parcels(db, ulpin, survey_number, plot_number, local_identifier, state, district, limit, offset)


@router.post("/identify-from-document", response_model=IdentifyFromDocumentResponse)
async def identify_from_document(
    document: UploadFile = File(...),
    db: Session = Depends(get_db),
    _citizen: User = Depends(require_roles(CITIZEN_ROLE)),
):
    if not (document.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image")
    data = await document.read()
    if len(data) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image exceeds the 5MB size limit")
    result = service.identify_from_document(db, data)
    return IdentifyFromDocumentResponse(
        extracted_text=result.extracted_text, ocr_confidence=result.ocr_confidence,
        candidates=[ParcelOut.model_validate(p) for p in result.candidates],
    )


@router.get("/mine", response_model=SearchParcelsResponse)
def get_my_parcels(db: Session = Depends(get_db), citizen: User = Depends(require_roles(CITIZEN_ROLE))):
    return service.find_mine(db, str(citizen.id))


@router.get("/{id}", response_model=ParcelOut)
def get_parcel(id: UUID, db: Session = Depends(get_db)):
    parcel = service.find_one(db, str(id))
    if not parcel:
        raise _not_found(id)
    return parcel


@router.get("/{id}/geometry")
def get_parcel_geometry(id: UUID, db: Session = Depends(get_db)):
    geometry = service.get_geometry(db, str(id))
    if not geometry:
        raise _not_found(id)
    return geometry


@router.get("/{id}/neighbours")
def get_neighbours(id: UUID, distance: float | None = None, db: Session = Depends(get_db)):
    result = service.get_neighbours(db, str(id), distance)
    if not result:
        raise _not_found(id)
    return result


@router.get("/{id}/context")
def get_context(id: UUID, distance: float | None = None, db: Session = Depends(get_db)):
    result = service.get_context(db, str(id), distance)
    if not result:
        raise _not_found(id)
    return result


@router.get("/{id}/workflows", response_model=list[WorkflowOut])
def get_workflows(id: UUID, db: Session = Depends(get_db)):
    if not service.find_one(db, str(id)):
        raise _not_found(id)
    return workflows_service.find_by_parcel(db, str(id))


@router.get("/{id}/360")
def get_parcel_360(id: UUID, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    result = response_aggregator_service.build_parcel_360(db, str(id))
    if result is None:
        raise _not_found(id)

    can_view_restricted = parcel_access.can_view_restricted_departments(db, user, str(id))
    if not can_view_restricted:
        parcel_access.mask_restricted_departments(result)

    response = parcel_360_to_json(result)
    response["restrictedForViewer"] = not can_view_restricted
    return response


@router.get("/{id}/ownership-history", response_model=list[OwnershipHistoryRecordOut])
def get_ownership_history(id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE))):
    if not service.find_one(db, str(id)):
        raise _not_found(id)
    if user.role == CITIZEN_ROLE and not service.is_citizen_associated_with_parcel(db, str(user.id), str(id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ownership history is only visible for parcels associated with your account")
    return service.get_ownership_history(db, str(id))


@router.get("/{id}/documents", response_model=list[ParcelDocumentOut])
def get_documents(id: UUID, db: Session = Depends(get_db)):
    if not service.find_one(db, str(id)):
        raise _not_found(id)
    return service.get_documents(db, str(id))


@router.get("/{id}/documents/{doc_id}/file")
def get_document_file(id: UUID, doc_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_STAFF_ROLES, CITIZEN_ROLE))):
    if user.role == CITIZEN_ROLE and not service.is_citizen_associated_with_parcel(db, str(user.id), str(id)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This document is only visible for parcels associated with your account")
    result = service.get_document_file(db, str(id), str(doc_id))
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document not found: {doc_id}")
    buffer, mime_type = result
    return Response(content=buffer, media_type=mime_type)


@router.get("/{id}/history", response_model=list[ParcelHistoricalStateOut])
def get_historical_states(id: UUID, year: int | None = None, db: Session = Depends(get_db)):
    if not service.find_one(db, str(id)):
        raise _not_found(id)
    return service.get_historical_states(db, str(id), year)


@router.get("/{id}/risk-score", response_model=RiskScoreOut)
def get_risk_score(id: UUID, db: Session = Depends(get_db)):
    result = predictive_analytics_service.get_risk_score(db, str(id))
    if result is None:
        raise _not_found(id)
    return result


@router.get("/{id}/audit", response_model=list[AuditLogOut])
def get_audit(id: UUID, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    if not service.find_one(db, str(id)):
        raise _not_found(id)
    return audit_service.find_by_parcel(db, str(id))
