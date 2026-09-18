"""Data-mapping layer for the official Form 7/12-style document PDF
(BACKLOG.md item 14 follow-up). Pulls every field the PDF needs from the
database and assembles a clean LandRecordPDFData tree - the PDF generator
(app/common/parcel_generation/official_document_generator.py) receives
only this dataclass and never queries the database itself.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.land_record_adapters import adapt_land_records_result
from app.common.parcel_generation.cluster_generator import CLUSTER_CONFIGS
from app.services import land_records_lookup_service
from app.config import get_settings
from app.models.department_record import RegistrationRecord, TaxRecord
from app.models.parcel import CropRecord, OwnershipHistoryRecord, Parcel, ParcelIdentifier
from app.models.user import User
from app.models.workflow import Workflow, WorkflowStep

# {cluster_id: district display name}, e.g. "Pune", "Pune Rural" - the same
# lookup change_detection.py's /clusters route already uses; taluka is
# derived from it below rather than stored anywhere, since it's one fixed
# value per cluster (a village/city's taluka doesn't vary parcel to
# parcel) - matches how this app already treats district display names as
# cluster-level metadata, not a per-parcel database column.
_DISTRICT_BY_CLUSTER = {c.cluster_id: c.district for c in CLUSTER_CONFIGS}

# "Occupant Class - I" (freehold, unrestricted transfer) is the only tenure
# type this app models - there's no leasehold/government-land concept
# anywhere in the schema, so unlike every other field below this is a
# fixed label, not a lookup. Real per-parcel restriction status still shows
# separately via RestrictionRecord elsewhere in Parcel 360.
_OCCUPANT_CLASS = "I"


def _taluka_for_cluster(cluster_id: str | None) -> str | None:
    district = _DISTRICT_BY_CLUSTER.get(cluster_id) if cluster_id else None
    if district is None:
        return None
    if district.endswith(" Rural"):
        return f"{district[: -len(' Rural')]} Taluka"
    return f"{district} Taluka"


@dataclass
class ApplicantInfo:
    name: str
    application_no: str
    application_date: datetime
    approved_by: str | None
    approval_date: datetime | None


@dataclass
class ProfileInfo:
    name: str | None
    email: str | None
    mobile_number: str | None
    address: str | None
    government_id_number: str | None
    occupation: str | None


@dataclass
class ParcelInfo:
    parcel_id: str
    parcel_url: str
    village_name: str | None
    village_code: str | None
    taluka: str | None
    district_code: str
    state_code: str
    ulpin: str | None
    survey_number: str | None
    plot_number: str | None
    area_sq_m: float
    registration_status: str | None


@dataclass
class OwnershipRow:
    khata_number: str | None
    owner_name: str
    occupant_class: str
    area_sq_m: float
    assessment: float | None
    village_fund: str | None
    other_number: str | None
    other_rights: str | None
    transaction_type: str
    transaction_date: date


@dataclass
class MutationInfo:
    pending: bool
    latest_mutation_no: str | None
    latest_mutation_date: date | None


@dataclass
class CropRow:
    agricultural_year: str
    season: str
    khata_number: str | None
    crop_type: str
    crop_name: str
    irrigated_area_sq_m: float
    unirrigated_area_sq_m: float
    irrigation_source: str | None
    uncultivable_area_sq_m: float
    remark: str | None


@dataclass
class LandRecordPDFData:
    profile: ProfileInfo | None
    applicant: ApplicantInfo | None
    parcel: ParcelInfo
    ownership: list[OwnershipRow] = field(default_factory=list)
    mutation: MutationInfo = field(default_factory=lambda: MutationInfo(False, None, None))
    crops: list[CropRow] = field(default_factory=list)
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# Workflow types that represent a live mutation-in-progress against a
# parcel's ownership/registration record - the same distinction
# workflows_service.py's VERIFICATION_WORKFLOW_TYPES draws for OCR
# pre-checks, reused here for "is a mutation pending" rather than inventing
# a second, separate classification.
_MUTATION_WORKFLOW_TYPES = {"LAND_CLAIM_REQUEST", "CORRECTION_REQUEST"}
_OPEN_STATUSES = {"SUBMITTED", "UNDER_REVIEW"}


def build_land_record_pdf_data(
    db: Session,
    parcel: Parcel,
    user: User | None = None,
) -> LandRecordPDFData:
    identifiers = db.query(ParcelIdentifier).filter_by(parcel_id=str(parcel.id)).all()
    survey_number = next((i.identifier_value for i in identifiers if i.identifier_type == "SURVEY_NUMBER"), None)
    plot_number = next((i.identifier_value for i in identifiers if i.identifier_type == "PLOT_NUMBER"), None)

    registration = db.query(RegistrationRecord).filter_by(parcel_id=str(parcel.id)).first()
    tax = db.query(TaxRecord).filter_by(parcel_id=str(parcel.id)).first()

    # Build profile info from authenticated user
    profile = None
    if user is not None:
        profile = ProfileInfo(
            name=user.name,
            email=user.email,
            mobile_number=user.mobile_number,
            address=user.address,
            government_id_number=user.government_id_number,
            occupation=user.occupation,
        )

    parcel_info = ParcelInfo(
        parcel_id=str(parcel.id),
        parcel_url=f"{get_settings().frontend_url.rstrip('/')}/parcels/{parcel.id}",
        village_name=_DISTRICT_BY_CLUSTER.get(parcel.cluster_id),
        village_code=parcel.cluster_id,
        taluka=_taluka_for_cluster(parcel.cluster_id),
        district_code=parcel.district_code,
        state_code=parcel.state_code,
        ulpin=parcel.ulpin,
        survey_number=survey_number,
        plot_number=plot_number,
        area_sq_m=float(parcel.area_sq_m),
        registration_status=registration.registration_status if registration else None,
    )

    # Applicant/approval strip - the most recent APPROVED workflow for this
    # parcel, if one exists. A citizen may download this document without
    # ever having filed a request (e.g. a staff viewer pulling it directly),
    # in which case the strip is simply omitted rather than fabricated.
    applicant: ApplicantInfo | None = None
    latest_approved = (
        db.scalars(
            select(Workflow)
            .where(Workflow.parcel_id == str(parcel.id), Workflow.current_status == "APPROVED")
            .order_by(Workflow.created_at.desc())
        )
        .first()
    )
    if latest_approved is not None:
        approved_step = (
            db.scalars(
                select(WorkflowStep)
                .where(WorkflowStep.workflow_id == latest_approved.id, WorkflowStep.action == "APPROVE")
                .order_by(WorkflowStep.completed_at.desc())
            )
            .first()
        )
        applicant = ApplicantInfo(
            name=latest_approved.created_by or "-",
            application_no=str(latest_approved.id)[:8].upper(),
            application_date=latest_approved.created_at,
            approved_by=approved_step.assigned_role.replace("_", " ").title() if approved_step else None,
            approval_date=approved_step.completed_at if approved_step else None,
        )

    ownership_history = (
        db.query(OwnershipHistoryRecord).filter_by(parcel_id=str(parcel.id)).order_by(OwnershipHistoryRecord.transaction_date.asc()).all()
    )

    # Fallback: if no ownership history, try to get current owner from land records
    if not ownership_history:
        land_records_result = land_records_lookup_service.find_by_parcel_id(db, str(parcel.id))
        if land_records_result and land_records_result != land_records_lookup_service.PARCEL_NOT_FOUND:
            adapted = adapt_land_records_result(land_records_result)
            # Create a synthetic ownership row with current owner from land records
            ownership_history = [
                type('SyntheticOwnershipRecord', (), {
                    'khata_number': None,
                    'owner_name': adapted.owner_name,
                    'transaction_type': 'CURRENT',
                    'transaction_date': datetime.now().date(),
                    'document_reference': None,
                })()
            ]

    ownership_rows = [
        OwnershipRow(
            khata_number=row.khata_number,
            owner_name=row.owner_name,
            occupant_class=_OCCUPANT_CLASS,
            area_sq_m=float(parcel.area_sq_m),
            assessment=float(tax.assessed_value) if tax else None,
            village_fund=None,
            other_number=row.document_reference,
            other_rights=None,
            transaction_type=row.transaction_type,
            transaction_date=row.transaction_date,
        )
        for row in ownership_history
    ]

    latest_history_row = ownership_history[-1] if ownership_history else None
    has_pending_mutation = (
        db.query(Workflow)
        .filter(
            Workflow.parcel_id == str(parcel.id),
            Workflow.workflow_type.in_(_MUTATION_WORKFLOW_TYPES),
            Workflow.current_status.in_(_OPEN_STATUSES),
        )
        .first()
        is not None
    )
    mutation = MutationInfo(
        pending=has_pending_mutation,
        latest_mutation_no=latest_history_row.document_reference if latest_history_row else None,
        latest_mutation_date=latest_history_row.transaction_date if latest_history_row else None,
    )

    crop_records = db.query(CropRecord).filter_by(parcel_id=str(parcel.id)).order_by(CropRecord.agricultural_year.desc()).all()
    crop_rows = [
        CropRow(
            agricultural_year=row.agricultural_year,
            season=row.season,
            khata_number=ownership_rows[-1].khata_number if ownership_rows else None,
            crop_type=row.crop_type,
            crop_name=row.crop_name,
            irrigated_area_sq_m=float(row.irrigated_area_sq_m),
            unirrigated_area_sq_m=float(row.unirrigated_area_sq_m),
            irrigation_source=row.irrigation_source,
            uncultivable_area_sq_m=float(row.uncultivable_area_sq_m),
            remark=row.remark,
        )
        for row in crop_records
    ]

    return LandRecordPDFData(
        profile=profile,
        applicant=applicant,
        parcel=parcel_info,
        ownership=ownership_rows,
        mutation=mutation,
        crops=crop_rows,
    )
