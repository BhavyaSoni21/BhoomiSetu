"""Ported from backend/src/ai/schemas/*.schema.ts (Zod) + dto/*.dto.ts."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import CamelModel
from app.schemas.parcel import ParcelOut


class NaturalLanguageQuery(CamelModel):
    query: str = Field(min_length=1)


# --- Phase 2: Unified AI-Assisted Request Flow (§9, §10, §11, §15, §17) ----------


class UnderstandRequestIn(CamelModel):
    """Citizen's natural language description of the issue + the parcel it
    relates to. The AI conversation builds a structured understanding from
    this, optionally continuing an existing conversation transcript.
    """

    parcel_id: str = Field(min_length=1)
    description: str = Field(min_length=1, max_length=2000)
    conversation: list[dict[str, Any]] | None = None
    # ISO 639-1 code of the citizen's selected UI language (e.g. "hi", "ta").
    # Drives which language the AI writes user-facing text in; defaults to
    # detecting the citizen's own words when absent.
    language: str | None = None


class FactStatement(CamelModel):
    """A single fact tagged by the AI as either a database fact or a citizen
    statement (§15 - Facts vs Claims).
    """

    statement: str
    fact_type: Literal["DATABASE_FACT", "CITIZEN_STATEMENT"]
    source: str | None = None
    confidence: float | None = None


class DepartmentRouting(CamelModel):
    """One department identified by AI for routing the case (§17, §18).
    """

    department: str
    confidence: float | None = None
    reason: str | None = None


class UnderstandRequestOut(CamelModel):
    """Structured understanding output from the AI (§11.1, §15).

    Includes follow-up questions (§10) only when the AI still needs more
    information from the citizen to form a complete understanding.
    """

    parcel_id: str
    intent: str | None = None
    issues: list[str] = Field(default_factory=list)
    facts_stated_by_citizen: list[str] = Field(default_factory=list)
    facts_database: list[str] = Field(default_factory=list)
    departments: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    application_draft: str | None = None


class ApplicationDraftIn(CamelModel):
    """Confirmed structured understanding used to generate the formal
    application draft (§11.2, §13).
    """

    parcel_id: str
    intent: str | None = None
    issues: list[str] = Field(default_factory=list)
    facts_stated_by_citizen: list[str] = Field(default_factory=list)
    facts_database: list[str] = Field(default_factory=list)
    departments: list[str] = Field(default_factory=list)
    conversation: list[dict[str, Any]] | None = None
    language: str | None = None


class ApplicationDraftOut(CamelModel):
    """The AI-generated application draft text, with facts and claims
    explicitly separated (§15).
    """

    application_draft: str
    facts_database: list[str] = Field(default_factory=list)
    citizen_statements: list[str] = Field(default_factory=list)


class RoutingDecisionIn(CamelModel):
    """Input for AI routing: the citizen's confirmed understanding.
    """

    parcel_id: str
    intent: str | None = None
    issues: list[str] = Field(default_factory=list)
    departments: list[str] = Field(default_factory=list)
    language: str | None = None


class RoutingDecisionOut(CamelModel):
    """AI routing decision output (§17).

    Determines relevant departments, workflows, required capabilities, and
    potential priority — not just a department choice.
    """

    departments: list[DepartmentRouting] = Field(default_factory=list)
    workflows_per_department: dict[str, Any] | None = None
    required_capabilities: list[str] = Field(default_factory=list)
    priority: str | None = None
    reason: str | None = None


# --- Raw-AI-response validation (mirrors assistant-response.schema.ts /
# ai-explanation.schema.ts's Zod schemas exactly - extra="ignore" matches
# Zod's default strip-unknown-keys behavior) --------------------------------


class _AssistantFiltersIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Accepts either a short code ("MH") or the full name ("Maharashtra") -
    # ai_service normalizes whichever form the AI extracted before
    # querying, so this just needs to allow both lengths.
    state: str | None = Field(default=None, max_length=30)
    district: str | None = Field(default=None, max_length=40)
    tax_status: Literal["PAID", "PENDING", "OVERDUE"] | None = None
    has_restriction: bool | None = None
    land_use: Literal["RESIDENTIAL", "COMMERCIAL", "AGRICULTURAL", "MIXED_USE"] | None = None
    registration_status: Literal["REGISTERED", "PENDING", "NOT_REGISTERED"] | None = None


class AssistantResponseIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    intent: Literal["DATA_QUERY", "HELP"]
    # For DATA_QUERY: one short intro sentence - the backend fills in the
    # actual count/results, so the model is never the source of truth for
    # data it never queried. For HELP: the full answer.
    reply: str = Field(min_length=1, max_length=600)
    filters: _AssistantFiltersIn | None = None


class AiFindingIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str = Field(min_length=1)
    description: str = Field(min_length=1)


class AiExplanationIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    summary: str = Field(min_length=1)
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    findings: list[AiFindingIn]
    recommended_action: str = Field(min_length=1)


# --- Outward response shapes -------------------------------------------------


class AssistantQueryResponse(CamelModel):
    """`totalMatches`/camelCase field names follow this API's normal
    convention, but `filters`' own keys (tax_status, land_use, ...) are
    deliberately the AI's own vocabulary, kept snake_case verbatim - same
    split as the canonical envelope in app/schemas/interoperability.py.
    Route uses response_model_exclude_none so a HELP-shaped answer omits
    filters/totalMatches/results entirely rather than sending them as null.
    """

    intent: Literal["DATA_QUERY", "HELP"]
    reply: str
    filters: dict[str, Any] | None = None
    total_matches: int | None = None
    results: list[ParcelOut] | None = None


class AiExplanationOut(BaseModel):
    """Returned exactly as the AI schema names it (summary/risk_level/
    findings/recommended_action) - not run through CamelModel, since the
    original TS response is the validated Zod object passed straight
    through with no transformation.
    """

    summary: str
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    findings: list[AiFindingIn]
    recommended_action: str
