"""Ported from backend/src/interoperability/land-record-adapters.ts."""

from dataclasses import dataclass
from typing import Literal

from app.models.land_records import StateALandRecord, StateBLandRecord
from app.services.land_records_lookup_service import LandRecordsLookupResult

_SQM_PER_HECTARE = 10000
_SQFT_PER_SQM = 10.7639


@dataclass
class AdaptedLandRecord:
    source_schema: Literal["STATE_A", "STATE_B"]
    source_identifier: str
    owner_name: str
    area_sq_m: float
    locality: str
    raw: StateALandRecord | StateBLandRecord


# Tech.md #14 "State Adapter Mapping" - State A: survey_number ->
# source_identifier, owner_name -> ownership.owner_name, area_hectares ->
# area_sq_m.
def adapt_state_a(record: StateALandRecord) -> AdaptedLandRecord:
    return AdaptedLandRecord(
        source_schema="STATE_A",
        source_identifier=record.survey_number,
        owner_name=record.owner_name,
        area_sq_m=round(float(record.area_hectares) * _SQM_PER_HECTARE, 2),
        locality=record.village_code,
        raw=record,
    )


# Tech.md #14 State B: plot_id -> source_identifier, holder_name ->
# ownership.owner_name, land_extent_sqft -> area_sq_m.
def adapt_state_b(record: StateBLandRecord) -> AdaptedLandRecord:
    return AdaptedLandRecord(
        source_schema="STATE_B",
        source_identifier=record.plot_id,
        owner_name=record.holder_name,
        area_sq_m=round(float(record.land_extent_sqft) / _SQFT_PER_SQM, 2),
        locality=record.locality_id,
        raw=record,
    )


def adapt_land_records_result(result: LandRecordsLookupResult) -> AdaptedLandRecord:
    return adapt_state_a(result.data) if result.source == "STATE_A" else adapt_state_b(result.data)
