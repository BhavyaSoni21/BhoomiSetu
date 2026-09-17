"""Ported from backend/src/departments/{registration,planning,tax,restriction,
dispute,encumbrance}.service.ts - six independent, identically-shaped
`findByParcelId` lookups over the six mock department entities.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department_record import (
    DisputeRecord,
    EncumbranceRecord,
    PlanningRecord,
    RegistrationRecord,
    RestrictionRecord,
    TaxRecord,
)


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


# Department dashboard widgets (BACKLOG.md item 26 follow-up) - each
# department's own "what needs my attention" list, not a per-parcel lookup.
def find_overdue_tax(db: Session) -> list[TaxRecord]:
    return list(db.scalars(select(TaxRecord).where(TaxRecord.tax_status == "OVERDUE")).all())


def find_pending_building_permissions(db: Session) -> list[PlanningRecord]:
    return list(db.scalars(select(PlanningRecord).where(PlanningRecord.building_permission_status == "PENDING")).all())


def find_pending_registrations(db: Session) -> list[RegistrationRecord]:
    return list(db.scalars(select(RegistrationRecord).where(RegistrationRecord.registration_status == "PENDING")).all())
