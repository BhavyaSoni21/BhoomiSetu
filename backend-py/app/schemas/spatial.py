import json
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.common.geometry_json import geometry_to_geojson
from app.schemas.base import CamelModel


class FeatureCollection(CamelModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[dict[str, Any]]


def to_feature_collection(rows: list, props_of) -> FeatureCollection:
    return FeatureCollection(
        features=[
            {"type": "Feature", "properties": props_of(row), "geometry": geometry_to_geojson(row.geometry)}
            for row in rows
        ]
    )


class _GeometryStringMixin(CamelModel):
    """Same opaque, double-JSON-encoded geometry string shape as
    ParcelOut - see that schema's docstring (app/schemas/parcel.py) for why.
    """

    geometry: str

    @field_validator("geometry", mode="before")
    @classmethod
    def _serialize_geometry(cls, value):
        return json.dumps(geometry_to_geojson(value))


# --- Zoning overlays ---------------------------------------------------------


class CreateZoningOverlay(CamelModel):
    name: str = Field(max_length=100)
    zone_type: Literal["RESIDENTIAL", "COMMERCIAL", "AGRICULTURAL"]
    proposed_land_use: str | None = Field(default=None, max_length=50)
    proposed_effective_year: int | None = None
    state_code: str = Field(max_length=10)
    district: str = Field(max_length=40)
    geometry: dict[str, Any]
    parcel_ids: list[str] | None = None


class UpdateZoningOverlay(CamelModel):
    name: str | None = Field(default=None, max_length=100)
    zone_type: Literal["RESIDENTIAL", "COMMERCIAL", "AGRICULTURAL"] | None = None
    proposed_land_use: str | None = Field(default=None, max_length=50)
    proposed_effective_year: int | None = None
    state_code: str | None = Field(default=None, max_length=10)
    district: str | None = Field(default=None, max_length=40)
    geometry: dict[str, Any] | None = None
    parcel_ids: list[str] | None = None


class ZoningOverlayOut(_GeometryStringMixin):
    id: UUID
    name: str
    zone_type: str
    proposed_land_use: str | None
    proposed_effective_year: int | None
    state_code: str
    district: str
    parcel_ids: list[str] | None
    created_at: datetime


# --- Restriction zones -------------------------------------------------------


class CreateRestrictionZone(CamelModel):
    name: str = Field(max_length=100)
    restriction_type: Literal["FLOOD", "ENVIRONMENTAL", "PROTECTED_AREA"]
    state_code: str = Field(max_length=10)
    district: str = Field(max_length=40)
    geometry: dict[str, Any]
    affected_parcel_ids: list[str] | None = None


class UpdateRestrictionZone(CamelModel):
    name: str | None = Field(default=None, max_length=100)
    restriction_type: Literal["FLOOD", "ENVIRONMENTAL", "PROTECTED_AREA"] | None = None
    state_code: str | None = Field(default=None, max_length=10)
    district: str | None = Field(default=None, max_length=40)
    geometry: dict[str, Any] | None = None
    affected_parcel_ids: list[str] | None = None


class RestrictionZoneOut(_GeometryStringMixin):
    id: UUID
    name: str
    restriction_type: str
    state_code: str
    district: str
    affected_parcel_ids: list[str] | None
    created_at: datetime


# --- Infrastructure features -------------------------------------------------


class CreateInfrastructureFeature(CamelModel):
    name: str = Field(max_length=100)
    feature_type: Literal["ROAD", "WATER_LINE", "ELECTRICITY"]
    state_code: str = Field(max_length=10)
    district: str = Field(max_length=40)
    geometry: dict[str, Any]


class UpdateInfrastructureFeature(CamelModel):
    name: str | None = Field(default=None, max_length=100)
    feature_type: Literal["ROAD", "WATER_LINE", "ELECTRICITY"] | None = None
    state_code: str | None = Field(default=None, max_length=10)
    district: str | None = Field(default=None, max_length=40)
    geometry: dict[str, Any] | None = None


class InfrastructureFeatureOut(_GeometryStringMixin):
    id: UUID
    name: str
    feature_type: str
    state_code: str
    district: str
    created_at: datetime


# --- Admin map notes ----------------------------------------------------------


class CreateAdminMapNote(CamelModel):
    name: str = Field(max_length=100)
    notes: str | None = None
    state_code: str = Field(max_length=10)
    district: str = Field(max_length=40)
    geometry: dict[str, Any]


class UpdateAdminMapNote(CamelModel):
    name: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    state_code: str | None = Field(default=None, max_length=10)
    district: str | None = Field(default=None, max_length=40)
    geometry: dict[str, Any] | None = None


class AdminMapNoteOut(_GeometryStringMixin):
    id: UUID
    name: str
    notes: str | None
    state_code: str
    district: str
    created_by_user_id: str | None
    created_at: datetime
