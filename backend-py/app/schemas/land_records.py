"""Ported from backend/src/land-records/dto/*.dto.ts."""

from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel

# --- State A (rural/revenue-village schema) ----------------------------------


class CreateStateALandRecord(CamelModel):
    survey_number: str = Field(max_length=50)
    subdivision_number: str = Field(max_length=20)
    owner_name: str = Field(max_length=100)
    village_code: str = Field(max_length=30)
    area_hectares: float = Field(gt=0)
    record_status: str | None = Field(default=None, max_length=20)


class UpdateStateALandRecord(CamelModel):
    survey_number: str | None = Field(default=None, max_length=50)
    subdivision_number: str | None = Field(default=None, max_length=20)
    owner_name: str | None = Field(default=None, max_length=100)
    village_code: str | None = Field(default=None, max_length=30)
    area_hectares: float | None = Field(default=None, gt=0)
    record_status: str | None = Field(default=None, max_length=20)


class StateALandRecordOut(CamelModel):
    record_id: UUID
    survey_number: str
    subdivision_number: str
    owner_name: str
    village_code: str
    area_hectares: float
    record_status: str


class StateALandRecordListResponse(CamelModel):
    records: list[StateALandRecordOut]
    total: int


# --- State B (urban plot schema) ----------------------------------------------


class CreateStateBLandRecord(CamelModel):
    plot_id: str = Field(max_length=50)
    holder_name: str = Field(max_length=100)
    locality_id: str = Field(max_length=30)
    land_extent_sqft: float = Field(gt=0)
    record_category: str = Field(max_length=30)


class UpdateStateBLandRecord(CamelModel):
    plot_id: str | None = Field(default=None, max_length=50)
    holder_name: str | None = Field(default=None, max_length=100)
    locality_id: str | None = Field(default=None, max_length=30)
    land_extent_sqft: float | None = Field(default=None, gt=0)
    record_category: str | None = Field(default=None, max_length=30)


class StateBLandRecordOut(CamelModel):
    record_id: UUID
    plot_id: str
    holder_name: str
    locality_id: str
    land_extent_sqft: float
    record_category: str


class StateBLandRecordListResponse(CamelModel):
    records: list[StateBLandRecordOut]
    total: int
