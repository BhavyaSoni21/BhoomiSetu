from pydantic import Field

from app.schemas.base import CamelModel


class ClusterYears(CamelModel):
    cluster_id: str
    years: list[int]


class CategorizedParcelOut(CamelModel):
    id: str
    canonical_parcel_id: str | None
    ulpin: str | None
    state_code: str
    district_code: str
    local_body_code: str
    area_sq_m: float
    geometry: str
    category: str


class CompareYears(CamelModel):
    from_year: int = Field(ge=2000, le=2100)
    to_year: int = Field(ge=2000, le=2100)


class AffectedParcelOut(CamelModel):
    parcel_id: str
    canonical_parcel_id: str
    from_category: str
    to_category: str
    narrative: str
    alert_id: str | None


class HistoricalComparisonResultOut(CamelModel):
    cluster_id: str
    from_year: int
    to_year: int
    change_detected: bool
    affected_parcels: list[AffectedParcelOut]
