"""Ported from backend/src/workflows/request-routing.service.ts.

Replaces the deterministic pipeline (pipeline_for() in
workflows_service.py) as the PRIMARY routing mechanism when the AI is
available and returns a valid result. The deterministic pipeline is the
guaranteed fallback: on any failure (unconfigured, transport error,
malformed/empty JSON, or every returned code failing validation), this
returns an empty pipeline and the caller falls back to pipeline_for()
unchanged - request submission never breaks or hangs on AI, matching
narrative_service's established swallow-to-fallback discipline elsewhere
in this codebase.
"""

import logging
from dataclasses import dataclass, field

from app.auth.roles import DEPARTMENT_ROLE
from app.services import groq_service

logger = logging.getLogger(__name__)


@dataclass
class PipelineStage:
    department: str
    assigned_role: str


@dataclass
class RoutingResult:
    pipeline: list[PipelineStage] = field(default_factory=list)
    routing_notes: str | None = None


_DEPARTMENT_DESCRIPTIONS = {
    "LAND_RECORDS": "Survey numbers, ownership records, and title documentation.",
    "REGISTRATION": "Property registration and transaction recording.",
    "PLANNING": "Zoning classification, land use, and master plan oversight.",
    "TAX": "Property tax assessment and collection.",
    "RESTRICTION": "Environmental, protected-area, and other land-use restrictions.",
    "DISPUTE": "Ownership, boundary, inheritance, and encroachment dispute resolution.",
    "ENCUMBRANCE": "Mortgages, liens, and other charges registered against a parcel.",
    "SURVEY": "Physical field measurement, cadastral map geometry updates, and boundary demarcation.",
}
_VALID_DEPARTMENTS = list(_DEPARTMENT_DESCRIPTIONS.keys())

_SYSTEM_PROMPT = f"""You are BhoomiSetu's request-routing assistant. A citizen has raised a service request against a land parcel; your job is to decide which department(s) should review it, based only on the request type and its free-text details.

Departments and what each one handles:
{chr(10).join(f"- {code}: {desc}" for code, desc in _DEPARTMENT_DESCRIPTIONS.items())}

Respond with ONLY a JSON object of this exact shape:
{{"departments": string[], "reason": string}}

"departments" must be a non-empty array using ONLY the department codes listed above, in the order they should review the request (most relevant first). Pick every department the request genuinely concerns - most requests need only one, but a request that touches more than one area (e.g. a correction that's really a dispute) may need more. "reason" is one short sentence explaining the choice, written for the officer who will see it (e.g. "Concerns an unpaid tax bill mentioned in the request details.").

Never invent a department code that isn't in the list above."""


def suggest_pipeline(workflow_type: str, request_details: str | None) -> RoutingResult:
    if not request_details or not request_details.strip():
        return RoutingResult()

    try:
        user_prompt = f"Request type: {workflow_type}\nRequest details: {request_details}"
        raw = groq_service.complete_json(_SYSTEM_PROMPT, user_prompt)
        return _parse_result(raw)
    except Exception as error:  # noqa: BLE001 - AI failure must never block request submission
        logger.warning("AI request routing failed, falling back to the default pipeline: %s", error)
        return RoutingResult()


def _parse_result(raw: object) -> RoutingResult:
    if not isinstance(raw, dict) or not isinstance(raw.get("departments"), list):
        return RoutingResult()

    departments = raw["departments"]
    reason = raw.get("reason")

    valid_codes = list(dict.fromkeys(code for code in departments if isinstance(code, str) and code in _VALID_DEPARTMENTS))
    if not valid_codes:
        return RoutingResult()

    pipeline = [PipelineStage(department=department, assigned_role=DEPARTMENT_ROLE[department]) for department in valid_codes]
    routing_notes = reason.strip() if isinstance(reason, str) and reason.strip() else None
    return RoutingResult(pipeline=pipeline, routing_notes=routing_notes)
