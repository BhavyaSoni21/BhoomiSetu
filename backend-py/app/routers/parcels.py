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

import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user_optional, require_roles
from app.auth.roles import ALL_STAFF_ROLES, CITIZEN_ROLE
from app.database import get_db
from app.document_verification.verifier import dist_code, run_verification, vill_code
from app.models.parcel import CitizenParcel, Parcel, ParcelIdentifier
from app.models.user import User
from app.models.workflow import Workflow
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
from app.services.workflows_service import CreateWorkflowInput

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


@router.post("/verify")
async def verify_parcel(
    document: UploadFile = File(...),
    khate_kramank: str = Form(""),
    owner_name: str = Form(""),
    survey_number: str = Form(""),
    village: str = Form(""),
    taluka: str = Form(""),
    district: str = Form(""),
    mobile: str = Form(""),
    ulpin: str | None = Form(None),
    db: Session = Depends(get_db),
    citizen: User = Depends(require_roles(CITIZEN_ROLE)),
):
    data = await document.read()
    if len(data) > _MAX_IMAGE_BYTES * 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document exceeds the 10MB size limit")

    user_inputs = {
        "khate_kramank": khate_kramank,
        "owner_name": owner_name,
        "survey_number": survey_number,
        "village": village,
        "taluka": taluka,
        "district": district,
        "mobile": mobile,
        "ulpin": ulpin or "",
    }

    report = run_verification(data, document.filename or "document.pdf", user_inputs)
    verdict = report["verdict"]
    local_id = report["local_id"]

    if verdict in ("VERIFIED", "PARTIAL MATCH"):
        # Check if matching parcel exists or create
        parcel = db.query(Parcel).filter(
            (Parcel.canonical_parcel_id == local_id) |
            (Parcel.identifiers.any(identifier_value=local_id)) |
            (Parcel.identifiers.any(identifier_value=survey_number, identifier_type="SURVEY_NUMBER") if survey_number else False)
        ).first()

        if not parcel:
            dist_c = dist_code(district)
            vill_c = vill_code(village)
            seed_hash = abs(hash(local_id)) % 1000
            base_lng = 74.0 + (seed_hash % 50) * 0.02
            base_lat = 19.0 + ((seed_hash // 50) % 50) * 0.02
            geom = from_shape(
                Polygon([
                    (base_lng, base_lat),
                    (base_lng + 0.0012, base_lat),
                    (base_lng + 0.0012, base_lat + 0.0012),
                    (base_lng, base_lat + 0.0012),
                    (base_lng, base_lat),
                ]),
                srid=4326,
            )
            parcel = Parcel(
                canonical_parcel_id=local_id,
                ulpin=ulpin if ulpin and len(ulpin) >= 11 else None,
                state_code="MH",
                district_code=dist_c,
                local_body_code=vill_c,
                area_sq_m=1250.0,
                geometry=geom,
            )
            db.add(parcel)
            db.flush()

            db.add(ParcelIdentifier(parcel_id=parcel.id, identifier_type="LOCAL_PARCEL_ID", identifier_value=local_id, source_state="MH", source_department="LAND_RECORDS"))
            if survey_number:
                db.add(ParcelIdentifier(parcel_id=parcel.id, identifier_type="SURVEY_NUMBER", identifier_value=survey_number, source_state="MH", source_department="LAND_RECORDS"))
            if khate_kramank:
                db.add(ParcelIdentifier(parcel_id=parcel.id, identifier_type="KHATE_KRAMANK", identifier_value=khate_kramank, source_state="MH", source_department="LAND_RECORDS"))
            if ulpin:
                db.add(ParcelIdentifier(parcel_id=parcel.id, identifier_type="ULPIN", identifier_value=ulpin, source_state="MH", source_department="LAND_RECORDS"))
            db.flush()

        parcel_status = "Registered" if verdict == "VERIFIED" else "Pending Verification"
        citizen_link = db.query(CitizenParcel).filter_by(citizen_id=citizen.id, parcel_id=parcel.id).first()
        if not citizen_link:
            citizen_link = CitizenParcel(
                citizen_id=citizen.id,
                parcel_id=parcel.id,
                status=parcel_status,
                local_id=local_id,
                verification_report=json.dumps(report),
            )
            db.add(citizen_link)
        else:
            citizen_link.status = parcel_status
            citizen_link.local_id = local_id
            citizen_link.verification_report = json.dumps(report)
        db.flush()

        # If PARTIAL MATCH, also file an automatic review workflow for officer queue
        if verdict == "PARTIAL MATCH":
            checks_list = [
                {"field": f["field"], "expectedValue": f["user"], "status": "MATCHED" if f["match"] else "MISMATCH"}
                for f in report["field_results"]
            ]
            precheck_payload = json.dumps({
                "verdict": "PARTIAL_MATCH",
                "match_percent": report["match_percent"],
                "local_id": local_id,
                "field_results": report["field_results"],
                "checks": checks_list,
            })
            workflows_service.create(
                db,
                CreateWorkflowInput(
                    parcel_id=str(parcel.id),
                    workflow_type="DOCUMENT_VERIFICATION_REQUEST",
                    created_by=owner_name or citizen.name,
                    request_details=f"Document ownership verification for {local_id} (Match score: {report['match_percent']}%)",
                    citizen_id=str(citizen.id),
                    applicant_contact=mobile or citizen.mobile_number or citizen.email,
                    applicant_address=citizen.address,
                ),
            )
            recent_wf = db.query(Workflow).filter_by(parcel_id=str(parcel.id), citizen_id=str(citizen.id)).order_by(Workflow.created_at.desc()).first()
            if recent_wf:
                recent_wf.verification_precheck = precheck_payload
                db.flush()

        parcel.status = parcel_status
        parcel.local_id = local_id
        report["parcel"] = ParcelOut.model_validate(parcel).model_dump(by_alias=True)

    report["localId"] = report.get("local_id")
    report["matchPercent"] = report.get("match_percent")
    report["matchedCount"] = report.get("matched_count")
    report["totalFields"] = report.get("total_fields")
    report["fieldResults"] = report.get("field_results")
    report["documentCheck"] = report.get("document_check")

    return report


@router.get("/citizen/{citizen_id}/parcels", response_model=SearchParcelsResponse)
def get_citizen_parcels(citizen_id: UUID, db: Session = Depends(get_db)):
    return service.find_mine(db, str(citizen_id))


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
