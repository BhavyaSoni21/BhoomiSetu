"""Ported from backend/src/departments/land-records-lookup.service.ts.

Mock Land Records Department API facade (Tech.md #16.1): given a parcel,
find its record in whichever state-specific schema applies - MH parcels
resolve via their SURVEY_NUMBER identifier into state_a_land_records, DL
parcels via PLOT_NUMBER into state_b_land_records. There's no stored
parcel<->record link (real department systems don't share BhoomiSetu's
internal keys); this is the minimal identifier-based join needed to
expose land record data by parcel - exactly the resolution
InteroperabilityModule's identifier resolver will generalize. TN/KA have
no state schema in this mock, so they resolve to None.
"""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.common.identifier_utils import find_identifier_value
from app.models.land_records import StateALandRecord, StateBLandRecord
from app.models.parcel import Parcel

PARCEL_NOT_FOUND = "PARCEL_NOT_FOUND"


@dataclass
class LandRecordsLookupResult:
    source: Literal["STATE_A", "STATE_B"]
    schema_name: str
    identifier_type: str
    identifier_value: str
    data: StateALandRecord | StateBLandRecord


def find_by_parcel_id(db: Session, parcel_id: str) -> LandRecordsLookupResult | None | str:
    parcel = db.get(Parcel, parcel_id)
    if parcel is None:
        return PARCEL_NOT_FOUND

    if parcel.state_code == "MH":
        return _resolve_state_a(db, parcel_id)
    if parcel.state_code == "DL":
        return _resolve_state_b(db, parcel_id)
    return None


def _resolve_state_a(db: Session, parcel_id: str) -> LandRecordsLookupResult | None:
    survey_number = find_identifier_value(db, parcel_id, "SURVEY_NUMBER")
    if not survey_number:
        return None
    record = db.query(StateALandRecord).filter(StateALandRecord.survey_number == survey_number).first()
    if record is None:
        return None
    return LandRecordsLookupResult(source="STATE_A", schema_name="state_a_land_records", identifier_type="SURVEY_NUMBER", identifier_value=survey_number, data=record)


def _resolve_state_b(db: Session, parcel_id: str) -> LandRecordsLookupResult | None:
    plot_id = find_identifier_value(db, parcel_id, "PLOT_NUMBER")
    if not plot_id:
        return None
    record = db.query(StateBLandRecord).filter(StateBLandRecord.plot_id == plot_id).first()
    if record is None:
        return None
    return LandRecordsLookupResult(source="STATE_B", schema_name="state_b_land_records", identifier_type="PLOT_NUMBER", identifier_value=plot_id, data=record)
