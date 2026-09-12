"""Ported from backend/src/ai/ai.service.ts.

Tech.md #28-#32 / Plan.md Phase 8. The AI service only ever: converts a
query to a structured filter the backend then executes itself (#29.1,
"the LLM must never directly execute unrestricted SQL"), or summarizes/
explains data that already exists. It never writes to any record - see
AI SECURITY RULES (#32).
"""

import json

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department_record import PlanningRecord, RegistrationRecord, RestrictionRecord, TaxRecord
from app.models.parcel import Parcel
from app.models.user import User
from app.schemas.ai import AiExplanationIn, AssistantResponseIn
from app.schemas.interoperability import parcel_360_to_json
from app.services import groq_service, parcel_access, response_aggregator_service
from app.services.governance_alerts_service import find_one as find_alert

# The floating "Ask AI" widget (docs/Plan.md's citizen-assistant addendum)
# handles two kinds of question in a single Groq call, rather than a
# separate classification round trip first - that would double the latency
# the widget is specifically trying to avoid.
_ASSISTANT_SYSTEM_PROMPT = """You are BhoomiSetu's citizen assistant, embedded as a chat widget on the Citizen Portal. You ONLY help with two things:

1. DATA_QUERY - a question about actual parcels/land records (e.g. "parcels with overdue tax", "show me restricted land in Pune"). Convert it into a structured filter.
2. HELP - a question about how to use the BhoomiSetu website, or navigation help (e.g. "how do I file a dispute", "where can I verify a document", "how do I see my parcels").

Anything else - general knowledge, other topics, small talk, requests unrelated to land records or this website - is OFF_TOPIC. Treat OFF_TOPIC exactly like HELP (same JSON shape, intent "HELP"), but "reply" must briefly say you can only help with BhoomiSetu parcel/land-record questions and site navigation, and must NOT attempt to actually answer the unrelated question - not even partially.

Respond with ONLY a JSON object of this exact shape:
{"intent": "DATA_QUERY"|"HELP", "reply": string, "filters"?: {"state"?: string, "district"?: string, "tax_status"?: "PAID"|"PENDING"|"OVERDUE", "has_restriction"?: boolean, "land_use"?: "RESIDENTIAL"|"COMMERCIAL"|"AGRICULTURAL"|"MIXED_USE", "registration_status"?: "REGISTERED"|"PENDING"|"NOT_REGISTERED"}}

For DATA_QUERY: set "filters" to the extracted criteria (only include a key the question actually asked about), and set "reply" to one short, friendly sentence introducing the results (e.g. "Here are the parcels with overdue tax in Pune."). Do NOT state a count or list results yourself - the backend runs the real query and fills that in.
For HELP (including OFF_TOPIC, per above): omit "filters" entirely, and set "reply" to a direct, plain-language answer using ONLY the real features listed below - never invent a feature that isn't listed, and never state a fact about any specific parcel's data (you have none for a HELP question).

Actual website features you may describe:
- Parcel Search: search by ULPIN, Survey Number, Plot Number, Local Identifier, State, or District code.
- Map View: an interactive map of the searched/selected parcel plus adjacent, nearby, and same-cluster parcels, with optional zoning/restriction/infrastructure/change-detection overlay layers.
- Parcel 360: click "View" on a parcel to see its full record - identifiers, land record, registration, planning, tax, restrictions, disputes, and a risk assessment.
- Service Requests: from a parcel's page, file a Record-of-Rights copy request, a correction request, or a dispute - track status in "Your Requests" on that parcel's page.
- Verify a Document: upload a photo/scan of a land document; it's checked against a selected parcel's official records for matching owner name, identifiers, and area.
- My Parcels: sign in (optional - never required to search) to see the parcels linked to your account.
- Ask AI (this chat): ask about parcel data in plain language, or ask how to do something on the site.

Never include SQL, code, or any field not listed above.

CRITICAL LANGUAGE RULE - follow this exactly: detect the language the citizen's question (given as the user message) is written in, and write "reply" in that exact same language, from the first word to the last. A Hindi (Devanagari script) question gets a Hindi (Devanagari script) reply. An English question gets an English reply. A Marathi question gets a Marathi reply. Do this regardless of what language this instruction or the feature list above is written in - those are instructions to you, not a language to reply in. Never mix languages within "reply", and never default to English when the question was not in English.

Examples (format only - never reuse this exact content as a real answer):
User message: "पुणे में बकाया कर वाले भूखंड दिखाओ" -> {"intent":"DATA_QUERY","reply":"यहाँ पुणे में बकाया कर वाले भूखंड हैं।","filters":{"district":"Pune","tax_status":"OVERDUE"}}
User message: "How do I file a dispute?" -> {"intent":"HELP","reply":"Open a parcel's page and use the Service Requests section to file a dispute; track its status in Your Requests on that same page."}
User message: "मुझे एक कविता लिखो" -> {"intent":"HELP","reply":"मैं केवल भूमिसेतु पर भूखंड और भूमि-अभिलेख से जुड़े सवालों में, और वेबसाइट का उपयोग करने में मदद कर सकता हूं।"}"""

_RESULT_LIMIT = 50

# The AI naturally extracts a state/district the way the user phrased it
# (e.g. "Pune", "Maharashtra"), but scripts/seed.py stores parcels under
# short codes (district_code = the first 3 letters of the district name,
# uppercased; state_code is one of MH/TN/KA/DL). Tech.md #29.1 puts "the
# backend then executes the actual database query" - this is that step
# normalizing the AI's free-form value into the code this mock's data
# actually uses, rather than the query silently matching nothing.
_STATE_NAME_TO_CODE = {
    "MAHARASHTRA": "MH",
    "TAMIL NADU": "TN",
    "KARNATAKA": "KA",
    "DELHI": "DL",
    "NEW DELHI": "DL",
}


def _normalize_state_code(value: str) -> str:
    upper = value.strip().upper()
    return _STATE_NAME_TO_CODE.get(upper, upper)


def _normalize_district_code(value: str) -> str:
    return value.strip()[:3].upper()


class AiResponseValidationError(Exception):
    """Raised when the AI's JSON doesn't match the shape the caller
    needs - the router turns this into a 502, mirroring the original's
    BadGatewayException.
    """


def ask_assistant(db: Session, query: str) -> dict:
    raw = groq_service.complete_json(_ASSISTANT_SYSTEM_PROMPT, query)
    try:
        parsed = AssistantResponseIn.model_validate(raw)
    except ValidationError as error:
        raise AiResponseValidationError("AI returned a response that could not be validated") from error

    # A HELP answer (or a DATA_QUERY the model somehow returned with no
    # filters at all) needs no database work - just the conversational reply.
    if parsed.intent == "HELP" or parsed.filters is None:
        return {"intent": "HELP", "reply": parsed.reply}

    filters = parsed.filters.model_dump(exclude_none=True)

    stmt = select(Parcel)
    if parsed.filters.state:
        stmt = stmt.where(Parcel.state_code == _normalize_state_code(parsed.filters.state))
    if parsed.filters.district:
        stmt = stmt.where(Parcel.district_code == _normalize_district_code(parsed.filters.district))
    parcels = list(db.scalars(stmt).all())

    if parsed.filters.tax_status:
        matching_ids = {r.parcel_id for r in db.scalars(select(TaxRecord).where(TaxRecord.tax_status == parsed.filters.tax_status)).all()}
        parcels = [p for p in parcels if str(p.id) in matching_ids]
    if parsed.filters.has_restriction is not None:
        matching_ids = {r.parcel_id for r in db.scalars(select(RestrictionRecord).where(RestrictionRecord.has_restriction == parsed.filters.has_restriction)).all()}
        parcels = [p for p in parcels if str(p.id) in matching_ids]
    if parsed.filters.land_use:
        matching_ids = {r.parcel_id for r in db.scalars(select(PlanningRecord).where(PlanningRecord.land_use == parsed.filters.land_use)).all()}
        parcels = [p for p in parcels if str(p.id) in matching_ids]
    if parsed.filters.registration_status:
        matching_ids = {r.parcel_id for r in db.scalars(select(RegistrationRecord).where(RegistrationRecord.registration_status == parsed.filters.registration_status)).all()}
        parcels = [p for p in parcels if str(p.id) in matching_ids]

    return {"intent": "DATA_QUERY", "reply": parsed.reply, "filters": filters, "total_matches": len(parcels), "results": parcels[:_RESULT_LIMIT]}


def explain_parcel(db: Session, parcel_id: str, user: User | None) -> AiExplanationIn | None:
    """Returns None when the parcel doesn't exist (mirrors the TS
    'NOT_FOUND' sentinel - a plain None reads just as clearly in Python
    and the router already 404s on it the same way it 404s on any other
    missing-resource None).
    """
    parcel_360 = response_aggregator_service.build_parcel_360(db, parcel_id)
    if parcel_360 is None:
        return None

    # Same rule as GET /parcels/:id/360 - a viewer who isn't staff and
    # isn't the citizen this parcel is associated with never sees
    # Planning/Tax/Restriction/Dispute/Encumbrance, so an AI summary can't
    # leak them either.
    if not parcel_access.can_view_restricted_departments(db, user, parcel_id):
        parcel_access.mask_restricted_departments(parcel_360)

    system_prompt = (
        "You explain a land parcel's aggregated records to a citizen in plain, simple language. Respond with ONLY a JSON object of this exact shape:\n"
        '{"summary": string, "risk_level": "LOW"|"MEDIUM"|"HIGH", "findings": [{"type": string, "description": string}], "recommended_action": string}\n'
        "Base findings strictly on the data given - do not invent facts, ownership changes, or legal conclusions. Some department fields may be null because "
        'they\'re withheld from this viewer, not because nothing was found - never claim or imply "no restrictions/disputes/encumbrances" for a null field.'
    )
    import json

    raw = groq_service.complete_json(system_prompt, json.dumps(parcel_360_to_json(parcel_360)))
    try:
        return AiExplanationIn.model_validate(raw)
    except ValidationError as error:
        raise AiResponseValidationError("AI returned a parcel explanation that could not be validated") from error


def explain_alert(db: Session, alert_id: str) -> AiExplanationIn | None:
    alert = find_alert(db, alert_id)
    if alert is None:
        return None

    system_prompt = (
        "You explain a land-governance alert to an officer in plain language (Tech.md #29.3 style). Respond with ONLY a JSON object of this exact shape:\n"
        '{"summary": string, "risk_level": "LOW"|"MEDIUM"|"HIGH", "findings": [{"type": string, "description": string}], "recommended_action": string}\n'
        "Base this strictly on the alert data given - never approve, dismiss, or make a legal determination yourself; recommended_action should describe "
        "what an officer should check, not a final decision."
    )
    raw = groq_service.complete_json(
        system_prompt,
        json.dumps({"alertType": alert.alert_type, "severity": alert.severity, "source": alert.source, "explanation": alert.explanation, "parcelId": alert.parcel_id}),
    )
    try:
        return AiExplanationIn.model_validate(raw)
    except ValidationError as error:
        raise AiResponseValidationError("AI returned an alert explanation that could not be validated") from error
