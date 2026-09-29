import json
from datetime import datetime
from uuid import UUID

from pydantic import field_validator

from app.common.geometry_json import geometry_to_geojson
from app.schemas.base import CamelModel


class ParcelOut(CamelModel):
    """Matches backend/src/parcels/parcel.entity.ts's serialized shape
    exactly, geometry included: TypeORM stored `geometry` as a raw GeoJSON
    *string* column and returned it to the frontend as-is (an opaque
    string, double-JSON-encoded within the response) - callers that needed
    the actual shape always JSON.parse()'d it themselves (see
    GisService.getGeometry below). backend-py's `geometry` is a real
    PostGIS column, not text, so this schema converts it back to that same
    string-typed shape at the API boundary for contract parity, even
    though it reads oddly next to a real geometry type - not something to
    silently "fix" here without also confirming nothing on the frontend
    still depends on the string form.
    """

    id: UUID
    canonical_parcel_id: str | None
    cluster_id: str | None
    ulpin: str | None
    state_code: str
    district_code: str
    local_body_code: str
    geometry: str
    area_sq_m: float
    street_address: str | None = None
    locality: str | None = None
    landmark: str | None = None
    pincode: str | None = None
    status: str = "Registered"
    tax_status: str | None = None
    local_id: str | None = None
    verification_report: str | None = None
    legal_status_severity: int = 0
    value_band: int = 0
    risk_score: float = 0.0
    masterplan_mismatch: bool = False
    unauthorized_construction_suspected: bool = False
    created_at: datetime
    updated_at: datetime

    @field_validator("geometry", mode="before")
    @classmethod
    def _serialize_geometry(cls, value):
        return json.dumps(geometry_to_geojson(value))


class ParcelListResponse(CamelModel):
    parcels: list[ParcelOut]
    total: int


class ParcelFeatureProperties(CamelModel):
    id: UUID
    canonical_parcel_id: str | None
    ulpin: str | None
    state_code: str
    district_code: str
    local_body_code: str
    area_sq_m: float
    street_address: str | None = None
    locality: str | None = None
    landmark: str | None = None
    pincode: str | None = None


class ParcelFeature(CamelModel):
    type: str = "Feature"
    properties: ParcelFeatureProperties
    geometry: dict
