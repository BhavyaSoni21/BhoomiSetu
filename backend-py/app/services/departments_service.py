"""Department service — per-parcel department business records + capability matrix."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin import Department
from app.models.department_record import (
    DisputeRecord,
    EncumbranceRecord,
    PlanningRecord,
    RegistrationRecord,
    RestrictionRecord,
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
