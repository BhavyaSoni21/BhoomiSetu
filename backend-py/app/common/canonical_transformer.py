"""Ported from backend/src/interoperability/canonical-transformer.ts.

Tech.md #15 "Canonical Parcel Response" - the standard structure every
department response gets transformed into before aggregation.
Deliberately snake_case, matching the spec's own JSON example verbatim,
even though the rest of this API is camelCase - this is the one shape
meant to be a fixed external contract, not an internal implementation
detail (so it does NOT use CamelModel/to_camel).
"""

from app.common.geometry_json import geometry_to_geojson
from app.models.parcel import Parcel


def build_canonical_envelope(
    parcel: Parcel,
    survey_number: str | None,
    plot_number: str | None,
    local_identifier: str | None,
    locality: str,
    source_availability: dict[str, bool],
) -> dict:
    return {
        "parcel_id": str(parcel.id),
        "identifiers": {
            "ulpin": parcel.ulpin,
            "survey_number": survey_number,
            "plot_number": plot_number,
            "local_identifier": local_identifier,
        },
        "location": {
            "state": parcel.state_code,
            "district": parcel.district_code,
            "locality": locality,
        },
        "spatial": {
            "area_sq_m": parcel.area_sq_m,
            "geometry": geometry_to_geojson(parcel.geometry),
        },
        "legal_status_severity": parcel.legal_status_severity or 0,
        "value_band": parcel.value_band or 0,
        "risk_score": float(parcel.risk_score or 0),
        "sources": [{"department": department, "status": "AVAILABLE" if available else "NOT_AVAILABLE"} for department, available in source_availability.items()],
    }
