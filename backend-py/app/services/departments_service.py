"""Department service — per-parcel department business records + capability matrix."""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin import Department
from app.models.department_record import (
    DisputeRecord,
    EncumbranceCertificate,
    EncumbranceRecord,
    PlanningRecord,
    RegistrationRecord,
    RestrictionRecord,
    SurveyDocument,
    SurveyRecord,
    TaxRecord,
)


def get_department_by_code(db: Session, code: str) -> Department | None:
    """Look up a Department by its code (e.g. 'SURVEY', 'LAND_RECORDS')."""
    return db.scalars(select(Department).where(Department.code == code)).first()


def get_department_by_id(db: Session, dept_id: str) -> Department | None:
    """Look up a Department by its UUID."""
    return db.get(Department, dept_id)


def department_has_capability(db: Session, department_id: str, capability: str) -> bool:
    """Check if a department has a specific capability (§20, §60).

    Args:
        department_id: Either a UUID string or a department code (e.g. 'SURVEY').
        capability: The capability string to check (e.g. 'VIEW_PARCEL', 'EDIT_TAX_DATA').

    Returns:
        True if the department has the capability, False otherwise.
    """
    dept = db.get(Department, department_id)
    if dept is None:
        dept = get_department_by_code(db, department_id)
    if dept is None:
        return False
    caps = dept.capabilities or []
    return capability in caps


def officer_can_perform_capability(db: Session, officer_role: str, department_code: str, capability: str) -> bool:
    """Check if an officer's role can perform a capability in a department (§20, §63).

    An officer can perform a capability if:
    1. Their role maps to the department (via ROLE_DEPARTMENT)
    2. The department has that capability
    """
    from app.auth.roles import ROLE_DEPARTMENT
    officer_dept_code = ROLE_DEPARTMENT.get(officer_role)
    if officer_dept_code is None:
        return False
    if officer_dept_code != department_code:
        return False
    dept = get_department_by_code(db, department_code)
    if dept is None:
        return False
    caps = dept.capabilities or []
    return capability in caps


def find_registration_by_parcel(db: Session, parcel_id: str) -> RegistrationRecord | None:
    return db.scalars(select(RegistrationRecord).where(RegistrationRecord.parcel_id == parcel_id)).first()


def find_planning_by_parcel(db: Session, parcel_id: str) -> PlanningRecord | None:
    return db.scalars(select(PlanningRecord).where(PlanningRecord.parcel_id == parcel_id)).first()


def find_tax_by_parcel(db: Session, parcel_id: str) -> TaxRecord | None:
    return db.scalars(select(TaxRecord).where(TaxRecord.parcel_id == parcel_id)).first()


def find_restriction_by_parcel(db: Session, parcel_id: str) -> RestrictionRecord | None:
    return db.scalars(select(RestrictionRecord).where(RestrictionRecord.parcel_id == parcel_id)).first()


def find_dispute_by_parcel(db: Session, parcel_id: str) -> DisputeRecord | None:
    return db.scalars(select(DisputeRecord).where(DisputeRecord.parcel_id == parcel_id)).first()


def find_encumbrance_by_parcel(db: Session, parcel_id: str) -> EncumbranceRecord | None:
    return db.scalars(select(EncumbranceRecord).where(EncumbranceRecord.parcel_id == parcel_id)).first()


def find_survey_by_parcel(db: Session, parcel_id: str) -> SurveyRecord | None:
    return db.scalars(select(SurveyRecord).where(SurveyRecord.parcel_id == parcel_id)).first()


# Department dashboard widgets (BACKLOG.md item 26 follow-up) - each
# department's own "what needs my attention" list, not a per-parcel lookup.
def find_overdue_tax(db: Session, skip: int = 0, limit: int = 10) -> list[TaxRecord]:
    return list(db.scalars(select(TaxRecord).where(TaxRecord.tax_status == "OVERDUE").offset(skip).limit(limit)).all())


def find_pending_building_permissions(db: Session, skip: int = 0, limit: int = 10) -> list[PlanningRecord]:
    return list(db.scalars(select(PlanningRecord).where(PlanningRecord.building_permission_status == "PENDING").offset(skip).limit(limit)).all())


def find_pending_registrations(db: Session, skip: int = 0, limit: int = 10) -> list[RegistrationRecord]:
    return list(db.scalars(select(RegistrationRecord).where(RegistrationRecord.registration_status == "PENDING").offset(skip).limit(limit)).all())


def find_pending_surveys(db: Session, skip: int = 0, limit: int = 10) -> list[SurveyRecord]:
    return list(db.scalars(select(SurveyRecord).where(SurveyRecord.survey_status == "PENDING").offset(skip).limit(limit)).all())


# --- Officer department dashboards (BACKLOG item 12) ---
# These build the exact camelCase shapes the officer pages consume, straight
# from existing per-parcel records - no new tables. Pages whose feature needs
# a model that doesn't exist yet (encumbrance certificates, survey document
# store, duplicate-registration detection) get an honest empty list from the
# router instead, so the page renders its empty state rather than 422ing.

def list_fraud_prevention(db: Session) -> list[dict]:
    """Parcels with an active encumbrance that ALSO carry a dispute or
    restriction - the core "don't mortgage disputed/restricted land" cross-check."""
    encs = db.scalars(select(EncumbranceRecord).where(EncumbranceRecord.has_encumbrance.is_(True))).all()
    out: list[dict] = []
    for e in encs:
        disp = find_dispute_by_parcel(db, e.parcel_id)
        restr = find_restriction_by_parcel(db, e.parcel_id)
        has_disp = bool(disp and disp.has_active_dispute)
        has_restr = bool(restr and restr.has_restriction)
        if not (has_disp or has_restr):
            continue  # no conflict = not a fraud risk
        level, score = ("CRITICAL", 90) if (has_disp and has_restr) else ("HIGH", 70) if has_disp else ("MEDIUM", 50)
        out.append({
            "id": str(e.id),
            "parcelId": e.parcel_id,
            "ulpin": e.parcel_id,
            "fraudRiskLevel": level,
            "riskScore": score,
            "activeEncumbranceRequest": {
                "id": str(e.id),
                "requestType": e.encumbrance_type or "MORTGAGE",
                "applicantName": e.lender_name or "—",
                "amount": 0,
                "requestedAt": e.registered_date.isoformat() if e.registered_date else None,
            },
            "disputeStatus": {
                "hasActiveDispute": has_disp,
                "disputeType": disp.dispute_type if disp else None,
                "disputeId": str(disp.id) if disp else None,
                "status": disp.case_status if disp else None,
            },
            "restrictionStatus": {
                "hasActiveRestriction": has_restr,
                "restrictionType": restr.restriction_type if restr else None,
                "restrictionId": str(restr.id) if restr else None,
            },
            "flaggedAt": e.registered_date.isoformat() if e.registered_date else None,
            "flaggedBy": "System cross-check",
        })
    return out


def list_survey_records_for_officer(db: Session) -> list[dict]:
    recs = db.scalars(select(SurveyRecord)).all()
    status_map = {"NO_CHANGE": "COMPLETED"}
    return [{
        "id": str(s.id),
        "parcelId": s.parcel_id,
        "surveyType": s.survey_type or "INITIAL",
        "status": status_map.get(s.survey_status, s.survey_status),
        "surveyorName": s.reference_document or "Field Survey Team",
        "startedAt": None,
        "completedAt": s.survey_date.isoformat() if s.survey_date else None,
        "measuredArea": float(s.measured_area_sq_m) if s.measured_area_sq_m is not None else None,
        "recordedArea": float(s.original_area_sq_m) if s.original_area_sq_m is not None else None,
        "areaDelta": float(s.area_delta_sq_m) if s.area_delta_sq_m is not None else None,
        "geometryUpdated": s.geometry_updated,
    } for s in recs]


def list_registration_chain(db: Session) -> list[dict]:
    """One chain entry per registered parcel. RegistrationRecord is a single
    snapshot, so each parcel currently has a one-step chain."""
    recs = db.scalars(select(RegistrationRecord).where(RegistrationRecord.registration_status == "REGISTERED")).all()
    return [{
        "id": str(r.id),
        "parcelId": r.parcel_id,
        "chainStep": 1,
        "registrationNumber": r.registration_number or "—",
        "registrationDate": r.registration_date.isoformat() if r.registration_date else None,
        "transactionType": r.last_transaction_type or "SALE",
        "previousOwner": "—",
        "newOwner": "—",
        "considerationAmount": None,
        "documentReference": r.registration_number or "—",
        "registrationStatus": r.registration_status,
        "linkedMutationId": None,
        "registeredBy": "IGR",
    } for r in recs]


def list_duplicate_registrations(db: Session) -> list[dict]:
    """Flag registrations sharing one registration number across different
    records - an exact-match duplicate registration anomaly (IGR cross-check).
    Derived live from RegistrationRecord; the earliest-dated record in a group
    is the "original", each later one a conflicting duplicate."""
    recs = db.scalars(
        select(RegistrationRecord).where(RegistrationRecord.registration_number.isnot(None))
    ).all()
    groups: dict[str, list[RegistrationRecord]] = {}
    for r in recs:
        groups.setdefault(r.registration_number, []).append(r)  # type: ignore[arg-type]

    def _reg(r: RegistrationRecord) -> dict:
        return {
            "id": str(r.id),
            "registrationNumber": r.registration_number or "—",
            "date": r.registration_date.isoformat() if r.registration_date else "",
            "registeredOwner": "—",  # RegistrationRecord carries no owner name
        }

    out: list[dict] = []
    for number, members in groups.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda r: (r.registration_date or date.min))
        original = members[0]
        for conflicting in members[1:]:
            out.append({
                "id": str(conflicting.id),
                "parcelId": conflicting.parcel_id,
                "originalRegistration": _reg(original),
                "conflictingRegistration": _reg(conflicting),
                "duplicateFlag": "EXACT_MATCH",
                "flaggedAt": (conflicting.registration_date or date.today()).isoformat(),
                "status": "PENDING_REVIEW",
                "riskScore": 85,
            })
    return out


def _overdue_trend(recs: list[TaxRecord], today: date) -> list[dict]:
    """Last 6 months of accrued-overdue balance: for each month-end, the sum of
    still-outstanding amounts whose last payment predates that month-end.
    ponytail: derived proxy from last_payment_date, not a recorded monthly
    snapshot; replace with a real ledger history table if audit-grade trend needed."""
    from calendar import monthrange

    outstanding = [
        r for r in recs
        if float(r.outstanding_amount or 0) > 0 and r.last_payment_date is not None
    ]
    y, m = today.year, today.month
    seq: list[tuple[int, int]] = []
    for _ in range(6):
        seq.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    seq.reverse()

    trend: list[dict] = []
    for yy, mm in seq:
        month_end = date(yy, mm, monthrange(yy, mm)[1])
        total = sum(
            float(r.outstanding_amount) for r in outstanding
            if r.last_payment_date <= month_end
        )
        trend.append({"month": date(yy, mm, 1).strftime("%b"), "overdue": total})
    return trend


def list_tax_reassessment_queue(db: Session) -> list[dict]:
    """Tax records whose independent market/circle-rate reference differs from
    the assessed value - candidates for reassessment."""
    recs = db.scalars(select(TaxRecord).where(TaxRecord.market_value_reference.isnot(None))).all()
    out: list[dict] = []
    for r in recs:
        prev = float(r.assessed_value or 0)
        prop = float(r.market_value_reference or 0)
        if prop == prev:
            continue
        diff = prop - prev
        out.append({
            "id": str(r.id),
            "parcelId": r.parcel_id,
            "mutationReference": str(r.id),
            "reassessmentReason": "MARKET_VALUE_REVISION",
            "previousAssessment": prev,
            "proposedAssessment": prop,
            "differenceAmount": diff,
            "differencePercent": (diff / prev * 100) if prev else 0,
            "requestedAt": r.valuation_date.isoformat() if r.valuation_date else None,
            "status": "PENDING_REVIEW",
        })
    return out


def tax_analytics(db: Session) -> dict:
    recs = db.scalars(select(TaxRecord)).all()
    total_demand = sum(float(r.annual_tax_amount or 0) for r in recs)
    total_overdue = sum(float(r.outstanding_amount or 0) for r in recs)
    total_collected = max(total_demand - total_overdue, 0)

    cats: dict[str, dict] = {}
    for r in recs:
        c = cats.setdefault(r.tax_status or "UNKNOWN", {"collected": 0.0, "demand": 0.0})
        demand = float(r.annual_tax_amount or 0)
        c["demand"] += demand
        c["collected"] += demand - float(r.outstanding_amount or 0)
    collection_by_category = [
        {"category": k, "collected": max(v["collected"], 0), "demand": v["demand"]}
        for k, v in cats.items()
    ]

    today = date.today()
    overdue = sorted(
        (r for r in recs if float(r.outstanding_amount or 0) > 0),
        key=lambda r: float(r.outstanding_amount), reverse=True,
    )[:10]
    top_overdue = [{
        "parcelId": r.parcel_id,
        "owner": "—",
        "overdueAmount": float(r.outstanding_amount or 0),
        "yearsOverdue": max((today - r.last_payment_date).days // 365, 1) if r.last_payment_date else 1,
    } for r in overdue]

    reassess = list_tax_reassessment_queue(db)
    return {
        "collectionRate": (total_collected / total_demand * 100) if total_demand else 0,
        "totalDemand": total_demand,
        "totalCollected": total_collected,
        "totalOverdue": total_overdue,
        "overdueTrend": _overdue_trend(recs, today),
        "collectionByCategory": collection_by_category,
        "topOverdueParcels": top_overdue,
        "reassessmentStats": {
            "pending": len(reassess),
            "approved": 0,
            "rejected": 0,
            "totalValue": sum(x["proposedAssessment"] for x in reassess),
        },
    }


# --- Encumbrance certificates (#12a) ---
# ponytail: no separate certificate-request table. A "request" is derived live
# from any encumbered parcel that has no issued certificate yet, so the officer
# page has a real pending queue without a new table/seed to maintain.
_CERT_VALIDITY_DAYS = 90


def _encumbrance_to_entry(e: EncumbranceRecord) -> dict:
    return {
        "type": e.encumbrance_type or "MORTGAGE",
        "description": e.instrument_reference or (e.lender_name or "Registered encumbrance"),
        "amount": 0,
        "registeredAt": e.registered_date.isoformat() if e.registered_date else None,
        "status": "RELEASED" if e.discharge_date else "ACTIVE",
    }


def _certificate_to_dict(c: EncumbranceCertificate) -> dict:
    issued = c.issued_at
    valid_until = (issued + timedelta(days=_CERT_VALIDITY_DAYS)) if issued else None
    now = datetime.now(timezone.utc)
    if valid_until is not None and valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)
    status = "EXPIRED" if (valid_until and valid_until < now) else "ACTIVE"
    return {
        "id": str(c.id),
        "certificateNumber": c.certificate_number,
        "parcelId": c.parcel_id,
        "ulpin": c.parcel_id,
        "ownerName": "—",  # dept records carry no owner name
        "issuedAt": issued.isoformat() if issued else None,
        "validUntil": valid_until.isoformat() if valid_until else None,
        "status": status,
        "encumbrances": c.encumbrances_snapshot or [],
        "issuedBy": c.issued_by or "Encumbrance Department",
        "purpose": "VERIFICATION",
    }


def list_encumbrance_certificates(db: Session) -> list[dict]:
    recs = db.scalars(select(EncumbranceCertificate).order_by(EncumbranceCertificate.issued_at.desc())).all()
    return [_certificate_to_dict(c) for c in recs]


def list_certificate_requests(db: Session) -> list[dict]:
    """Encumbered parcels become the pending request queue; parcels that already
    have an issued certificate show as GENERATED."""
    encs = db.scalars(select(EncumbranceRecord).where(EncumbranceRecord.has_encumbrance.is_(True))).all()
    issued_parcels = set(db.scalars(select(EncumbranceCertificate.parcel_id)).all())
    out: list[dict] = []
    for e in encs:
        out.append({
            "parcelId": e.parcel_id,
            "purpose": "VERIFICATION",
            "requestedBy": "System cross-check",
            "requestedAt": e.registered_date.isoformat() if e.registered_date else None,
            "status": "GENERATED" if e.parcel_id in issued_parcels else "PENDING",
        })
    return out


def generate_encumbrance_certificate(db: Session, parcel_id: str, issued_by: str | None = None) -> EncumbranceCertificate:
    """Snapshot every encumbrance on the parcel, render + store a PDF, persist the row."""
    from app.common.parcel_generation.encumbrance_certificate_generator import render_encumbrance_certificate_pdf
    from app.common.supabase_storage import upload_to_storage

    encs = db.scalars(select(EncumbranceRecord).where(EncumbranceRecord.parcel_id == parcel_id)).all()
    active = [e for e in encs if e.has_encumbrance and not e.discharge_date]
    snapshot = [_encumbrance_to_entry(e) for e in encs if e.has_encumbrance]
    has_enc = bool(active)

    cert_id = uuid.uuid4()
    cert_number = f"EC-{date.today().strftime('%Y%m%d')}-{str(cert_id)[:8].upper()}"
    issued_at = datetime.now(timezone.utc)
    reg_dates = [e.registered_date for e in encs if e.registered_date]

    pdf = render_encumbrance_certificate_pdf(
        certificate_number=cert_number,
        parcel_id=parcel_id,
        ulpin=parcel_id,
        period_from=min(reg_dates) if reg_dates else None,
        period_to=date.today(),
        has_encumbrance=has_enc,
        encumbrances=[{
            "type": s["type"], "lender": s["description"], "instrument": s["description"],
            "registered": s["registeredAt"], "discharged": None if s["status"] == "ACTIVE" else "Yes",
        } for s in snapshot],
        issued_by=issued_by,
        issued_at=issued_at,
    )
    storage_key = f"encumbrance-certificates/{cert_id}.pdf"
    upload_to_storage(storage_key, pdf, "application/pdf")

    cert = EncumbranceCertificate(
        id=cert_id,
        parcel_id=parcel_id,
        certificate_number=cert_number,
        period_from=min(reg_dates) if reg_dates else None,
        period_to=date.today(),
        has_encumbrance=has_enc,
        encumbrances_snapshot=snapshot,
        storage_key=storage_key,
        issued_by=issued_by,
    )
    db.add(cert)
    db.flush()
    db.refresh(cert)
    return cert


def get_certificate_pdf(db: Session, cert_id: str) -> bytes | None:
    from app.common.supabase_storage import download_from_storage

    cert = db.get(EncumbranceCertificate, cert_id)
    if cert is None:
        return None
    return download_from_storage(cert.storage_key)


# --- Survey field-document store (#12b) ---
def _survey_document_to_dict(d: SurveyDocument) -> dict:
    return {
        "id": str(d.id),
        "parcelId": d.parcel_id,
        "surveyId": d.survey_id,
        "documentType": d.document_type,
        "fileName": d.file_name,
        # Served through the app's own auth-gated route, not a public URL.
        # Path is relative to the /api/v1 base the frontend's apiService prepends.
        "fileUrl": f"/survey/documents/{d.id}/file",
        "uploadedAt": d.uploaded_at.isoformat() if d.uploaded_at else None,
        "uploadedBy": d.uploaded_by,
        "description": d.description,
        "gpsCoordinates": {"lat": d.gps_lat, "lng": d.gps_lng} if d.gps_lat is not None and d.gps_lng is not None else None,
        "verified": d.verified,
        "verifiedAt": d.verified_at.isoformat() if d.verified_at else None,
        "verifiedBy": d.verified_by,
    }


def list_survey_documents(db: Session, parcel_id: str | None = None) -> list[dict]:
    stmt = select(SurveyDocument).order_by(SurveyDocument.uploaded_at.desc())
    if parcel_id:
        stmt = stmt.where(SurveyDocument.parcel_id == parcel_id)
    return [_survey_document_to_dict(d) for d in db.scalars(stmt).all()]


def create_survey_document(
    db: Session, *, parcel_id: str, file_name: str, content_type: str | None, data: bytes,
    document_type: str = "FIELD_MEASUREMENT", description: str | None = None,
    survey_id: str | None = None, gps_lat: float | None = None, gps_lng: float | None = None,
    uploaded_by: str | None = None,
) -> SurveyDocument:
    from app.common.supabase_storage import upload_to_storage

    doc_id = uuid.uuid4()
    storage_key = f"survey-documents/{doc_id}-{file_name}"
    upload_to_storage(storage_key, data, content_type or "application/octet-stream")
    doc = SurveyDocument(
        id=doc_id, parcel_id=parcel_id, survey_id=survey_id, document_type=document_type,
        file_name=file_name, content_type=content_type, storage_key=storage_key,
        description=description, gps_lat=gps_lat, gps_lng=gps_lng, uploaded_by=uploaded_by,
    )
    db.add(doc)
    db.flush()
    db.refresh(doc)
    return doc


def get_survey_document_file(db: Session, doc_id: str) -> tuple[bytes, str, str] | None:
    from app.common.supabase_storage import download_from_storage

    doc = db.get(SurveyDocument, doc_id)
    if doc is None:
        return None
    return download_from_storage(doc.storage_key), (doc.content_type or "application/octet-stream"), doc.file_name
