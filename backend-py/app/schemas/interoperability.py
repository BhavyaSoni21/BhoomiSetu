"""JSON shaping for ResponseAggregatorService.build_parcel_360's result.

The canonical envelope fields (parcel_id/identifiers/location/spatial/
sources) are a deliberately fixed, snake_case external contract (see
app/common/canonical_transformer.py) - not run through CamelModel.
`clusterId` and `departments` were added on top of that envelope by the
TS interface `Parcel360Response extends CanonicalParcelEnvelope`, and
follow this API's normal camelCase convention instead. Reusing the
existing per-department *Out schemas (already camelCase) here keeps this
one conversion honest about the contract split rather than inventing a
third shape.
"""

from decimal import Decimal
from typing import Any

from app.common.land_record_adapters import AdaptedLandRecord
from app.schemas.departments import (
    DisputeRecordOut,
    EncumbranceRecordOut,
    PlanningRecordOut,
    RegistrationRecordOut,
    RestrictionRecordOut,
    TaxRecordOut,
)
from app.schemas.land_records import StateALandRecordOut, StateBLandRecordOut


def _convert_decimals(obj: Any) -> Any:
    """Recursively convert Decimal to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_decimals(v) for v in obj]
    return obj


def _dump(schema, record) -> dict[str, Any] | None:
    if record is None:
        return None
    return _convert_decimals(schema.model_validate(record).model_dump(mode="json", by_alias=True))


def _land_record_out(adapted: AdaptedLandRecord | None) -> dict[str, Any] | None:
    if adapted is None:
        return None
    raw_schema = StateALandRecordOut if adapted.source_schema == "STATE_A" else StateBLandRecordOut
    return {
        "sourceSchema": adapted.source_schema,
        "sourceIdentifier": adapted.source_identifier,
        "ownerName": adapted.owner_name,
        "areaSqM": adapted.area_sq_m,
        "locality": adapted.locality,
        "raw": _dump(raw_schema, adapted.raw),
    }


def parcel_360_to_json(result: dict[str, Any]) -> dict[str, Any]:
    departments = result["departments"]
    return _convert_decimals({
        "parcel_id": result["parcel_id"],
        "identifiers": result["identifiers"],
        "location": result["location"],
        "spatial": result["spatial"],
        "sources": result["sources"],
        "clusterId": result["cluster_id"],
        "zoneMembership": result.get("zone_membership"),
        "conflicts": result.get("conflicts", []),
        "departments": {
            "landRecords": _land_record_out(departments["land_records"]),
            "registration": _dump(RegistrationRecordOut, departments["registration"]),
            "planning": _dump(PlanningRecordOut, departments["planning"]),
            "tax": _dump(TaxRecordOut, departments["tax"]),
            "restriction": _dump(RestrictionRecordOut, departments["restriction"]),
            "dispute": _dump(DisputeRecordOut, departments["dispute"]),
            "encumbrance": _dump(EncumbranceRecordOut, departments["encumbrance"]),
        },
    })
