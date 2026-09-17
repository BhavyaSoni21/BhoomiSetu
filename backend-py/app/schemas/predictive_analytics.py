from app.schemas.base import CamelModel


class RiskFactorOut(CamelModel):
    key: str
    label: str
    weight: float
    available: bool
    score: float
    rationale: str


class RiskScoreOut(CamelModel):
    parcel_id: str
    overall_score: float
    risk_band: str
    data_completeness: float
    factors: list[RiskFactorOut]
