"""Ported from backend/src/ai/schemas/*.schema.ts (Zod) + dto/*.dto.ts."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import CamelModel
from app.schemas.parcel import ParcelOut


class NaturalLanguageQuery(CamelModel):
    query: str = Field(min_length=1)


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
