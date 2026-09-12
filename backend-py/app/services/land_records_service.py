"""Ported from backend/src/land-records/state-a-land-records.service.ts +
state-b-land-records.service.ts.

Deliberately doesn't call app.common.pagination.resolve_pagination -
unlike AuditModule/PredictiveAnalyticsModule, neither original TS
service did either (`if (filters.limit) options.take = ...`, no default
cap): these are mock external department APIs, not the app's own
oversight/admin views KNOWN_RISKS.md HIGH-6 was about.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.land_records import StateALandRecord, StateBLandRecord
from app.schemas.land_records import (
    CreateStateALandRecord,
    CreateStateBLandRecord,
    UpdateStateALandRecord,
    UpdateStateBLandRecord,
)


def create_state_a(db: Session, dto: CreateStateALandRecord) -> StateALandRecord:
    record = StateALandRecord(**dto.model_dump(exclude_unset=True, by_alias=False), record_status=dto.record_status or "ACTIVE")
    db.add(record)
    db.flush()
    return record


def find_all_state_a(
    db: Session, survey_number: str | None = None, village_code: str | None = None, limit: int | None = None, offset: int | None = None
) -> tuple[list[StateALandRecord], int]:
    stmt = select(StateALandRecord)
    if survey_number:
        stmt = stmt.where(StateALandRecord.survey_number == survey_number)
    if village_code:
        stmt = stmt.where(StateALandRecord.village_code == village_code)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    if limit:
        stmt = stmt.limit(limit)
    if offset:
        stmt = stmt.offset(offset)
    return list(db.scalars(stmt).all()), total


def find_one_state_a(db: Session, record_id: UUID) -> StateALandRecord | None:
    return db.get(StateALandRecord, record_id)


def update_state_a(db: Session, record_id: UUID, dto: UpdateStateALandRecord) -> StateALandRecord | None:
    record = db.get(StateALandRecord, record_id)
    if record is None:
        return None
    for key, value in dto.model_dump(exclude_unset=True, by_alias=False).items():
        setattr(record, key, value)
    db.flush()
    return record


def remove_state_a(db: Session, record_id: UUID) -> bool:
    record = db.get(StateALandRecord, record_id)
    if record is None:
        return False
    db.delete(record)
    db.flush()
    return True


def create_state_b(db: Session, dto: CreateStateBLandRecord) -> StateBLandRecord:
    record = StateBLandRecord(**dto.model_dump(exclude_unset=True, by_alias=False))
    db.add(record)
    db.flush()
    return record


def find_all_state_b(
    db: Session, plot_id: str | None = None, locality_id: str | None = None, limit: int | None = None, offset: int | None = None
) -> tuple[list[StateBLandRecord], int]:
    stmt = select(StateBLandRecord)
    if plot_id:
        stmt = stmt.where(StateBLandRecord.plot_id == plot_id)
    if locality_id:
        stmt = stmt.where(StateBLandRecord.locality_id == locality_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    if limit:
        stmt = stmt.limit(limit)
    if offset:
        stmt = stmt.offset(offset)
    return list(db.scalars(stmt).all()), total


def find_one_state_b(db: Session, record_id: UUID) -> StateBLandRecord | None:
    return db.get(StateBLandRecord, record_id)


def update_state_b(db: Session, record_id: UUID, dto: UpdateStateBLandRecord) -> StateBLandRecord | None:
    record = db.get(StateBLandRecord, record_id)
    if record is None:
        return None
    for key, value in dto.model_dump(exclude_unset=True, by_alias=False).items():
        setattr(record, key, value)
    db.flush()
    return record


def remove_state_b(db: Session, record_id: UUID) -> bool:
    record = db.get(StateBLandRecord, record_id)
    if record is None:
        return False
    db.delete(record)
    db.flush()
    return True
