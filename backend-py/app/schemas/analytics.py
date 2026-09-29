from datetime import datetime

from pydantic import Field

from app.schemas.base import CamelModel


class DistributionOut(CamelModel):
    key: str
    count: int


class AnalyticsTotalsOut(CamelModel):
    parcels: int
    workflows: int
    cases: int
    open_cases: int
    open_alerts: int
    active_disputes: int
    total_users: int
    # pydantic's to_camel() title-cases "24h" into "24H" (a digit counts as
    # a word boundary for str.title()) - explicit alias to match the
    # original TS field name (recentLogins24h) exactly.
    recent_logins_24h: int = Field(alias="recentLogins24h")


class AnalyticsSummaryOut(CamelModel):
    totals: AnalyticsTotalsOut
    tax_status_distribution: list[DistributionOut]
    registration_status_distribution: list[DistributionOut]
    land_use_distribution: list[DistributionOut]
    dispute_case_status_distribution: list[DistributionOut]
    workflow_status_distribution: list[DistributionOut]
    workflow_type_distribution: list[DistributionOut]
    case_status_distribution: list[DistributionOut]
    case_intent_distribution: list[DistributionOut]
    case_priority_distribution: list[DistributionOut]
    department_task_status_distribution: list[DistributionOut]
    alert_severity_distribution: list[DistributionOut]
    alert_status_distribution: list[DistributionOut]


class OfficerMonitoringEntryOut(CamelModel):
    user_id: str
    name: str
    role: str
    department: str
    pending_in_role_queue: int
    approved_count: int
    rejected_count: int
    avg_decision_hours: float | None
    last_activity_at: datetime | None
