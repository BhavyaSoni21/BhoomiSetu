"""Ported from backend/src/departments/{registration,planning,tax,restriction,
dispute,encumbrance,land-records-lookup}.controller.ts.

Seven independent mock department APIs (Tech.md #16-17), each deliberately
unguarded (no JWT/roles) and independent of the canonical parcel model -
standing in for external systems this app doesn't own. `/land-records`
is distinct from `/state-a|state-b/land-records/:id`
(app/routers/land_records.py's raw schema CRUD) - it takes a *parcel* id
and resolves it to whichever state-specific record applies.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.deps import require_mock_dept_apis_enabled, require_roles
from app.auth.roles import ALL_STAFF_ROLES
from app.database import get_db
from app.models.user import User
from app.schemas.departments import (
    DepartmentStatsOut,
    DisputeRecordOut,
    EncumbranceRecordOut,
    LandRecordsLookupOut,
    PlanningRecordOut,
    RegistrationRecordOut,
    RestrictionRecordOut,
    SurveyRecordOut,
    TaxRecordOut,
)
from app.services import departments_service as service
from app.services import land_records_lookup_service

router = APIRouter(tags=["departments"])


# Department dashboard widgets (BACKLOG.md item 26 follow-up) - unlike every
# other route in this file, these ARE staff-gated: they're this app's own
# officer dashboard reading its own mock data, not a stand-in for an
# external system's public lookup. Registered before the per-parcel routes
# below so a literal path segment like "overdue" is never swallowed as a
# {parcel_id}.
@router.get("/tax/overdue", response_model=list[TaxRecordOut])
def list_overdue_tax(skip: int = 0, limit: int = 10, db: Session = Depends(get_db), _staff: User = Depends(require_roles("TAX_OFFICER", "ADMIN"))):
    return service.find_overdue_tax(db, skip, limit)


@router.get("/planning/pending-permissions", response_model=list[PlanningRecordOut])
def list_pending_building_permissions(skip: int = 0, limit: int = 10, db: Session = Depends(get_db), _staff: User = Depends(require_roles("PLANNING_OFFICER", "ADMIN"))):
    return service.find_pending_building_permissions(db, skip, limit)


@router.get("/registration/pending", response_model=list[RegistrationRecordOut])
def list_pending_registrations(skip: int = 0, limit: int = 10, db: Session = Depends(get_db), _staff: User = Depends(require_roles("REGISTRATION_OFFICER", "ADMIN"))):
    return service.find_pending_registrations(db, skip, limit)


@router.get("/survey/pending", response_model=list[SurveyRecordOut])
def list_pending_surveys(skip: int = 0, limit: int = 10, db: Session = Depends(get_db), _staff: User = Depends(require_roles("SURVEY_OFFICER", "ADMIN"))):
    return service.find_pending_surveys(db, skip, limit)


# Officer dashboard metric cards. Literal "/stats" prefix keeps it clear of the
# /{parcel_id} catch-alls below; any staff role may read any department's stats.
@router.get("/stats/{code}", response_model=DepartmentStatsOut)
def get_department_stats(code: str, db: Session = Depends(get_db), _staff: User = Depends(require_roles(*ALL_STAFF_ROLES))):
    return service.department_stats(db, code)


# Officer department dashboards (BACKLOG item 12). Literal paths, so - like the
# widgets above - they MUST stay above the /{parcel_id} catch-alls or Starlette
# treats "fraud-prevention"/"analytics"/etc. as a parcel id and 422s. Responses
# are built as plain camelCase dicts (no response_model) to match each page's
# TS interface directly; feature-incomplete ones return [] honestly.
@router.get("/encumbrance/fraud-prevention")
def encumbrance_fraud_prevention(db: Session = Depends(get_db), _staff: User = Depends(require_roles("ENCUMBRANCE_OFFICER", "ADMIN"))):
    return service.list_fraud_prevention(db)


@router.get("/encumbrance/certificates")
def encumbrance_certificates(db: Session = Depends(get_db), _staff: User = Depends(require_roles("ENCUMBRANCE_OFFICER", "ADMIN"))):
    return service.list_encumbrance_certificates(db)


@router.get("/encumbrance/certificate-requests")
def encumbrance_certificate_requests(db: Session = Depends(get_db), _staff: User = Depends(require_roles("ENCUMBRANCE_OFFICER", "ADMIN"))):
    return service.list_certificate_requests(db)


@router.post("/encumbrance/certificates/generate", status_code=status.HTTP_201_CREATED)
def generate_encumbrance_certificate(body: dict, db: Session = Depends(get_db), staff: User = Depends(require_roles("ENCUMBRANCE_OFFICER", "ADMIN"))):
    parcel_id = (body or {}).get("parcelId")
    if not parcel_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="parcelId required")
    cert = service.generate_encumbrance_certificate(db, str(parcel_id), issued_by=staff.name)
    db.commit()
    return service._certificate_to_dict(cert)


@router.get("/encumbrance/certificates/{cert_id}/pdf")
def get_encumbrance_certificate_pdf(cert_id: UUID, db: Session = Depends(get_db), _staff: User = Depends(require_roles("ENCUMBRANCE_OFFICER", "ADMIN"))):
    pdf = service.get_certificate_pdf(db, str(cert_id))
    if pdf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Certificate not found: {cert_id}")
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="encumbrance-certificate-{cert_id}.pdf"'},
    )


@router.get("/survey/records")
def survey_records(db: Session = Depends(get_db), _staff: User = Depends(require_roles("SURVEY_OFFICER", "ADMIN"))):
    return service.list_survey_records_for_officer(db)


@router.get("/survey/documents")
def survey_documents(parcelId: str | None = None, db: Session = Depends(get_db), _staff: User = Depends(require_roles("SURVEY_OFFICER", "ADMIN"))):
    return service.list_survey_documents(db, parcelId)


@router.post("/survey/documents/upload", status_code=status.HTTP_201_CREATED)
async def upload_survey_document(
    parcelId: str = Form(...),
    documentType: str = Form("FIELD_MEASUREMENT"),
    description: str | None = Form(None),
    surveyId: str | None = Form(None),
    gpsLat: float | None = Form(None),
    gpsLng: float | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    staff: User = Depends(require_roles("SURVEY_OFFICER", "ADMIN")),
):
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds the 15MB size limit")
    doc = service.create_survey_document(
        db, parcel_id=parcelId, file_name=file.filename or "document",
        content_type=file.content_type, data=data, document_type=documentType,
        description=description, survey_id=surveyId, gps_lat=gpsLat, gps_lng=gpsLng,
        uploaded_by=staff.name,
    )
    db.commit()
    return service._survey_document_to_dict(doc)


@router.get("/survey/documents/{doc_id}/file")
def get_survey_document_file(doc_id: UUID, download: bool = Query(False), db: Session = Depends(get_db), _staff: User = Depends(require_roles("SURVEY_OFFICER", "ADMIN"))):
    result = service.get_survey_document_file(db, str(doc_id))
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Survey document not found: {doc_id}")
    data, content_type, file_name = result
    disposition = "attachment" if download else "inline"
    return Response(
        content=data, media_type=content_type,
        headers={"Content-Disposition": f'{disposition}; filename="{file_name}"'},
    )


@router.get("/tax/reassessment-queue")
def tax_reassessment_queue(db: Session = Depends(get_db), _staff: User = Depends(require_roles("TAX_OFFICER", "ADMIN"))):
    return service.list_tax_reassessment_queue(db)


@router.get("/tax/analytics")
def tax_analytics(db: Session = Depends(get_db), _staff: User = Depends(require_roles("TAX_OFFICER", "ADMIN"))):
    return service.tax_analytics(db)


@router.get("/registration/chain")
def registration_chain(
    q: str | None = Query(None),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _staff: User = Depends(require_roles("REGISTRATION_OFFICER", "ADMIN")),
):
    records, total = service.list_registration_chain(db, q, limit, offset)
    return {"records": records, "total": total}


@router.get("/registration/duplicate-registry")
def registration_duplicate_registry(db: Session = Depends(get_db), _staff: User = Depends(require_roles("REGISTRATION_OFFICER", "ADMIN"))):
    return service.list_duplicate_registrations(db)


@router.get("/land-records/{parcel_id}", response_model=LandRecordsLookupOut)
def get_land_records(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    result = land_records_lookup_service.find_by_parcel_id(db, str(parcel_id))
    if result == land_records_lookup_service.PARCEL_NOT_FOUND:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Parcel not found: {parcel_id}")
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No land record could be resolved for parcel: {parcel_id}")
    return {
        "source": result.source,
        "schema": result.schema_name,
        "identifierUsed": {"type": result.identifier_type, "value": result.identifier_value},
        "data": result.data,
    }


@router.get("/registration/{parcel_id}", response_model=RegistrationRecordOut)
def get_registration(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    record = service.find_registration_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No registration record for parcel: {parcel_id}")
    return record


@router.get("/planning/{parcel_id}", response_model=PlanningRecordOut)
def get_planning(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    record = service.find_planning_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No planning record for parcel: {parcel_id}")
    return record


@router.get("/tax/{parcel_id}", response_model=TaxRecordOut)
def get_tax(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    record = service.find_tax_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No tax record for parcel: {parcel_id}")
    return record


@router.get("/restriction/{parcel_id}", response_model=RestrictionRecordOut)
def get_restriction(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    record = service.find_restriction_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No restriction record for parcel: {parcel_id}")
    return record


@router.get("/dispute/{parcel_id}", response_model=DisputeRecordOut)
def get_dispute(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    record = service.find_dispute_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No dispute record for parcel: {parcel_id}")
    return record


@router.get("/encumbrance/{parcel_id}", response_model=EncumbranceRecordOut)
def get_encumbrance(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    record = service.find_encumbrance_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No encumbrance record for parcel: {parcel_id}")
    return record


@router.get("/survey/{parcel_id}", response_model=SurveyRecordOut)
def get_survey(parcel_id: UUID, db: Session = Depends(get_db), _mock: None = Depends(require_mock_dept_apis_enabled)):
    record = service.find_survey_by_parcel(db, str(parcel_id))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No survey record for parcel: {parcel_id}")
    return record
