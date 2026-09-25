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
from app.schemas.ai import (
    AiExplanationIn,
    ApplicationDraftIn,
    ApplicationDraftOut,
    AssistantResponseIn,
    RoutingDecisionIn,
    UnderstandRequestIn,
    UnderstandRequestOut,
)
from app.schemas.interoperability import parcel_360_to_json
from app.services import groq_service, parcel_access, parcels_service, response_aggregator_service
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

CRITICAL GENDER RULE - follow this exactly: You are a female AI assistant (female persona). In Indian languages (such as Hindi, Marathi, Gujarati, Bengali, etc.) and any gendered language where self-referential verbs or adjectives change based on the speaker's gender, ALWAYS use female first-person grammatical forms for yourself. For instance, in Hindi use "सकती हूँ" instead of "सकता हूँ" (e.g., "मैं आपकी सहायता कर सकती हूँ", "मैं मदद कर सकती हूँ").

Examples (format only - never reuse this exact content as a real answer):
User message: "पुणे में बकाया कर वाले भूखंड दिखाओ" -> {"intent":"DATA_QUERY","reply":"यहाँ पुणे में बकाया कर वाले भूखंड हैं।","filters":{"district":"Pune","tax_status":"OVERDUE"}}
User message: "How do I file a dispute?" -> {"intent":"HELP","reply":"Open a parcel's page and use the Service Requests section to file a dispute; track its status in Your Requests on that same page."}
User message: "मुझे एक कविता लिखो" -> {"intent":"HELP","reply":"मैं केवल भूमिसेतु पर भूखंड और भूमि-अभिलेख से जुड़े सवालों में, और वेबसाइट का उपयोग करने में मदद कर सकती हूँ।"}"""

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
        "Be concise. Keep summary to one or two short sentences covering only the most important facts. Give at most 4 findings, each description a short phrase (not a paragraph). Keep recommended_action to one short sentence.\n"
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


# --- Phase 2: Unified AI-Assisted Request Flow (§9–18) ----------------------
# The citizen describes their issue in natural language; the AI produces a
# structured understanding, generates an application draft, and decides
# routing. The AI never writes to land records directly — it only shapes the
# case/application that officers then act on through the workflow engine.

_UNDERSTAND_SYSTEM_PROMPT = """You are BhoomiSetu's AI Assistant helping a citizen describe and structure their land-related issue. Your job is to produce a structured understanding that a human officer can act on.

You are given:
1. The citizen's description of the issue.
2. The parcel's 360° data (identifiers, ownership, tax, dispute, restriction, encumbrance, planning records — or null where withheld).
3. Any prior conversation turns.

CRITICAL RULE — Facts vs Claims (§15): Distinguish between database facts (what the records actually show) and citizen statements (what the citizen claims). Do NOT turn a citizen allegation into an established fact.

Respond with ONLY a JSON object of this exact shape:
{
  "parcel_id": string,
  "intent": string,
  "issues": [string],
  "facts_stated_by_citizen": [string],
  "facts_database": [string],
  "departments": [string],
  "follow_up_questions": [string],
  "application_draft": string | null
}

- "intent": the citizen's core request type (e.g. "BOUNDARY_DISPUTE", "RECORD_CORRECTION", "ENCROACHMENT_INVESTIGATION", "OWNERSHIP_CLARIFICATION", "TAX_DISPUTE", "RESTRICTION_CHALLENGE").
- "issues": 2-5 short machine-readable issue tags (e.g. "boundary_mismatch", "possible_encroachment").
- "facts_stated_by_citizen": the citizen's stated facts (not allegations — separate what they claim happened).
- "facts_database": only facts directly verifiable from the parcel 360° data above. Never invent. Never cite null/withheld fields as "no restriction" or similar.
- "departments": which department codes (SURVEY, DISPUTE, LAND_RECORDS, REGISTRATION, TAX, PLANNING, RESTRICTION, ENCUMBRANCE) the issue touches.
- "follow_up_questions": at most 3 questions, ONLY about the citizen's specific complaint that cannot be derived otherwise. Return an empty list as soon as the intent and core issue are clear. Follow these rules strictly:
  * NEVER ask about the parcel's location, address, owner, area, boundaries, tax, dispute, restriction, encumbrance or planning status — all of that is already provided in parcel_360 above. Read it from there; do not ask the citizen for it.
  * NEVER re-ask anything the citizen has already answered anywhere in the conversation. Read every prior turn first and account for each answer already given.
  * Only ask about what is genuinely missing to act on the complaint (e.g. what specifically is wrong, what outcome they want). If nothing essential is missing, return [].
- "application_draft": if the understanding is complete enough, generate a formal one-paragraph application draft. If follow-up questions are needed, set this to null.

CRITICAL LANGUAGE RULE — follow this exactly: detect the language the citizen wrote their own words in (the conversation turns), and write every human-readable text field — "follow_up_questions" and "application_draft" — entirely in that same language, from the first word to the last. The citizen may write in any of BhoomiSetu's 11 supported languages — English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil or Telugu — and you MUST reply in whichever one they used, in that language's native script. A Marathi (Devanagari) description gets Marathi questions and draft; a Tamil description gets Tamil; a Telugu one gets Telugu. Never default to English when the citizen did not write in English, and never mix languages. If the citizen's words are too short to tell, fall back to the user message's "respond_in_language" field (an ISO 639-1 code: en/hi/bn/gu/kn/ml/mr/or/pa/ta/te). Keep machine fields ("intent", "issues", "departments") as the English codes/tags specified above — never translate those.

Never include any field not listed above."""


def understand_request(db: Session, dto: UnderstandRequestIn) -> dict | None:
    """Run the AI conversation to produce a structured understanding of the
    citizen's issue (§10, §11).

    Gathers parcel context from the 360° view, then asks the AI to produce a
    structured understanding with fact/claim separation (§15) and follow-up
    questions when more information is needed (§10).

    Returns the validated structured understanding dict. The caller (router)
    is responsible for persisting it to an AIAnalysis row tied to a case.
    """
    parcel_360 = response_aggregator_service.build_parcel_360(db, dto.parcel_id)
    if parcel_360 is None:
        return None

    parcel_context = parcel_360_to_json(parcel_360)

    conversation = dto.conversation or [
        {"role": "citizen", "text": dto.description, "timestamp": _now_iso()}
    ]

    user_prompt = json.dumps({
        "parcel_360": parcel_context,
        "conversation": conversation,
        "respond_in_language": dto.language or "en",
    })

    raw = groq_service.complete_json(_UNDERSTAND_SYSTEM_PROMPT, user_prompt)
    try:
        return UnderstandRequestOut.model_validate(raw).model_dump()
    except ValidationError as error:
        raise AiResponseValidationError("AI returned a structured understanding that could not be validated") from error


_APPLICATION_DRAFT_SYSTEM_PROMPT = """You are BhoomiSetu's AI Assistant generating a formal application document from a citizen's confirmed request understanding.

You are given:
1. The parcel's 360° data (what the database actually records).
2. The AI's structured understanding of the issue (intent, issues, citizen facts, database facts, departments).
3. The conversation transcript (if any).

CRITICAL RULE — Facts vs Claims (§15): The application must explicitly separate database facts from citizen statements. Use phrases like "The record shows..." for database facts and "The citizen reports..." / "The citizen states..." for citizen statements. Never transform a citizen allegation into an established legal fact.

CRITICAL RULE — One paragraph: The application is a single formal paragraph, not a list or bullet points.

Respond with ONLY a JSON object of this exact shape:
{
  "application_draft": string,
  "facts_database": [string],
  "citizen_statements": [string]
}

- "application_draft": a single formal paragraph suitable as the official application text. Include: case/parcel identification context, the citizen-confirmed problem description, relevant parcel information, and the requested action.
- "facts_database": the list of database facts used from the parcel 360° data.
- "citizen_statements": the citizen's stated facts/claims, attributed to the citizen.

CRITICAL LANGUAGE RULE — follow this exactly: detect the language the citizen wrote their own words in (the conversation transcript) and write "application_draft" (and the human-readable text in "facts_database"/"citizen_statements") entirely in that same language, in that language's native script. The citizen may write in any of BhoomiSetu's 11 supported languages — English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil or Telugu — and you MUST reply in whichever one they used (Marathi→Marathi, Tamil→Tamil, Telugu→Telugu, …). Never default to English when the citizen did not write in English, and never mix languages. If the citizen's words are too short to tell, fall back to the user message's "respond_in_language" field (an ISO 639-1 code: en/hi/bn/gu/kn/ml/mr/or/pa/ta/te). Department codes and identifiers stay as-is.

Never include any field not listed above."""


def generate_application_draft(db: Session, dto: ApplicationDraftIn) -> dict | None:
    """Generate a formal application draft from the citizen's confirmed
    structured understanding (§11.2, §13, §15, §16).

    Uses the parcel 360° context to ground the draft in real database facts,
    keeping citizen claims attributed to the citizen.
    """
    parcel_360 = response_aggregator_service.build_parcel_360(db, dto.parcel_id)
    if parcel_360 is None:
        return None

    parcel_context = parcel_360_to_json(parcel_360)

    user_prompt = json.dumps({
        "parcel_360": parcel_context,
        "structured_understanding": {
            "intent": dto.intent,
            "issues": dto.issues,
            "facts_stated_by_citizen": dto.facts_stated_by_citizen,
            "facts_database": dto.facts_database,
            "departments": dto.departments,
        },
        "conversation": dto.conversation,
        "respond_in_language": dto.language or "en",
    })

    raw = groq_service.complete_json(_APPLICATION_DRAFT_SYSTEM_PROMPT, user_prompt)
    try:
        return ApplicationDraftOut.model_validate(raw).model_dump()
    except ValidationError as error:
        raise AiResponseValidationError("AI returned an application draft that could not be validated") from error


_ROUTING_SYSTEM_PROMPT = """You are BhoomiSetu's routing assistant. Your job is to determine which department(s) and workflow(s) should handle a citizen's confirmed case.

You are given:
1. The parcel's 360° data (for context on what departments already have records).
2. The AI's structured understanding (intent, issues, citizen facts, database facts, departments).
3. Available workflow templates by department.

CRITICAL: You are determining routing, not making a decision. Your output guides the workflow engine to create department tasks.

Respond with ONLY a JSON object of this exact shape:
{
  "departments": [{"department": string, "confidence": number, "reason": string}],
  "workflows_per_department": {department_code: {"workflow": string, "stages": [string], "capabilities": [string]}},
  "required_capabilities": [string],
  "priority": string | null,
  "reason": string
}

- "departments": ordered list of department codes (SURVEY, DISPUTE, LAND_RECORDS, REGISTRATION, TAX, PLANNING, RESTRICTION, ENCUMBRANCE), most relevant first.
- "workflows_per_department": for each department, suggest a workflow name and the stages/capabilities it would need. Use realistic workflow names like "BOUNDARY_VERIFICATION", "ENCROACHMENT_REVIEW", "RECORD_CORRECTION", "DISPUTE_RESOLUTION".
- "required_capabilities": capabilities needed across all departments (PARCEL_360, FIELD_VERIFICATION, GEO_PHOTO, DOCUMENT_REVIEW, APPOINTMENT, etc.).
- "priority": one of LOW, MEDIUM, HIGH, CRITICAL — based on urgency of the issue.
- "reason": one short sentence explaining the routing choice.

CRITICAL LANGUAGE RULE — follow this exactly: write the human-readable "reason" fields in the language given by the user message's "respond_in_language" field — an ISO 639-1 code for one of BhoomiSetu's 11 supported languages: en=English, hi=Hindi, bn=Bengali, gu=Gujarati, kn=Kannada, ml=Malayalam, mr=Marathi, or=Odia, pa=Punjabi, ta=Tamil, te=Telugu (default English when absent or "en"). Write those fields in that language's native script. All department codes, workflow names, capabilities and priority stay in English exactly as listed.

Never invent departments or workflows not in the available list below.

Available department/workflow templates:
- SURVEY: BOUNDARY_VERIFICATION, GEOMETRY_CORRECTION, FIELD_MEASUREMENT
- DISPUTE: ENCROACHMENT_REVIEW, DISPUTE_RESOLUTION, BOUNDARY_RESOLUTION
- LAND_RECORDS: RECORD_CORRECTION, OWNERSHIP_CLARIFICATION, DOCUMENT_VERIFICATION
- REGISTRATION: TITLE_REGISTRATION, DOCUMENT_AUTHENTICATION
- TAX: TAX_REVIEW, ASSESSMENT_CORRECTION
- PLANNING: ZONING_REVIEW, LAND_USE_VARIANCE
- RESTRICTION: RESTRICTION_REVIEW, ENVIRONMENTAL_CLEARANCE
- ENCUMBRANCE: ENCUMBRANCE_INVESTIGATION, LIEN_REVIEW"""


# Maps intent/issue signals to known workflow templates (§21, §23).
_INTENT_WORKFLOW_MAP = {
    "BOUNDARY_DISPUTE": ("SURVEY", "BOUNDARY_VERIFICATION"),
    "RECORD_CORRECTION": ("LAND_RECORDS", "RECORD_CORRECTION"),
    "ENCROACHMENT_INVESTIGATION": ("DISPUTE", "ENCROACHMENT_REVIEW"),
    "OWNERSHIP_CLARIFICATION": ("LAND_RECORDS", "OWNERSHIP_CLARIFICATION"),
    "TAX_DISPUTE": ("TAX", "TAX_REVIEW"),
    "RESTRICTION_CHALLENGE": ("RESTRICTION", "RESTRICTION_REVIEW"),
    "ENCUMBRANCE_INVESTIGATION": ("ENCUMBRANCE", "ENCUMBRANCE_INVESTIGATION"),
    "DOCUMENT_AUTHENTICATION": ("REGISTRATION", "DOCUMENT_AUTHENTICATION"),
    "GEO_PHOTO": ("SURVEY", "FIELD_MEASUREMENT"),
    "TITLE_REGISTRATION": ("REGISTRATION", "TITLE_REGISTRATION"),
    "ZONING_VARIANCE": ("PLANNING", "ZONING_REVIEW"),
    "LIEN_REVIEW": ("ENCUMBRANCE", "LIEN_REVIEW"),
    "APPOINTMENT": ("DISPUTE", "DISPUTE_RESOLUTION"),
}

_VALID_DEPARTMENTS = {"SURVEY", "DISPUTE", "LAND_RECORDS", "REGISTRATION", "TAX", "PLANNING", "RESTRICTION", "ENCUMBRANCE"}


def generate_routing_decision(db: Session, dto: RoutingDecisionIn) -> dict | None:
    """Generate AI routing decision for a confirmed case (§17, §18).

    Determines relevant departments, workflows, required capabilities, and
    priority. Falls back to deterministic routing based on intent/issue
    signals when the AI fails or returns invalid departments.
    """
    parcel_360 = response_aggregator_service.build_parcel_360(db, dto.parcel_id)
    if parcel_360 is None:
        return None

    parcel_context = parcel_360_to_json(parcel_360)

    user_prompt = json.dumps({
        "parcel_360": parcel_context,
        "structured_understanding": {
            "intent": dto.intent,
            "issues": dto.issues,
            "departments": dto.departments,
        },
        "respond_in_language": dto.language or "en",
    })

    try:
        raw = groq_service.complete_json(_ROUTING_SYSTEM_PROMPT, user_prompt)
        result = _parse_routing_result(raw)
        if result["departments"]:
            return result
    except Exception:
        logger.warning("AI routing failed, falling back to deterministic routing")

    # Deterministic fallback based on intent/issues
    return _deterministic_routing(dto)


def _parse_routing_result(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {"departments": [], "workflows_per_department": None, "required_capabilities": [], "priority": None, "reason": None}

    departments = []
    for item in raw.get("departments", []):
        if isinstance(item, dict) and isinstance(item.get("department"), str) and item["department"] in _VALID_DEPARTMENTS:
            depts = [d for d in departments if d["department"] == item["department"]]
            if not depts:
                departments.append({
                    "department": item["department"],
                    "confidence": item.get("confidence"),
                    "reason": item.get("reason"),
                })

    workflows = raw.get("workflows_per_department")
    if not isinstance(workflows, dict):
        workflows = None

    capabilities = [c for c in raw.get("required_capabilities", []) if isinstance(c, str)]
    priority = raw.get("priority") if isinstance(raw.get("priority"), str) else None
    reason = raw.get("reason") if isinstance(raw.get("reason"), str) else None

    return {
        "departments": departments,
        "workflows_per_department": workflows,
        "required_capabilities": capabilities,
        "priority": priority,
        "reason": reason,
    }


def _deterministic_routing(dto: RoutingDecisionIn) -> dict:
    """Fallback: route based on intent and issues using the known intent map."""
    departments = []
    workflows = {}
    capabilities = ["PARCEL_360", "DOCUMENT_REVIEW"]
    priority = None
    reason = "Deterministic routing based on intent/issues."

    intent = (dto.intent or "").upper()
    issues = [i.upper() for i in dto.issues]

    if intent in _INTENT_WORKFLOW_MAP or any(i in _INTENT_WORKFLOW_MAP for i in issues):
        handled = set()
        for key in [intent] + issues:
            if key in _INTENT_WORKFLOW_MAP and key not in handled:
                dept, workflow = _INTENT_WORKFLOW_MAP[key]
                if dept not in handled:
                    departments.append({"department": dept, "confidence": 0.8, "reason": f"Matched intent/issue: {key}"})
                    workflows[dept] = {"workflow": workflow, "stages": ["officer_review", "field_verification", "decision"], "capabilities": ["PARCEL_360", "FIELD_VERIFICATION", "GEO_PHOTO"]}
                    handled.add(dept)
        capabilities.extend(["FIELD_VERIFICATION", "GEO_PHOTO"])
    else:
        for dept in dto.departments:
            if dept in _VALID_DEPARTMENTS:
                departments.append({"department": dept, "confidence": 0.7, "reason": "Identified in understanding."})
                workflows[dept] = {"workflow": "MANUAL_REVIEW", "stages": ["officer_review", "decision"], "capabilities": ["PARCEL_360", "DOCUMENT_REVIEW"]}

    if not departments:
        departments = [{"department": "LAND_RECORDS", "confidence": 0.6, "reason": "Default routing for land-related issues."}]
        workflows["LAND_RECORDS"] = {"workflow": "RECORD_CORRECTION", "stages": ["officer_review", "decision"], "capabilities": ["PARCEL_360"]}

    if "CITIZEN" in str(intent) or "URGENT" in str(intent):
        priority = "HIGH"

    return {
        "departments": departments,
        "workflows_per_department": workflows,
        "required_capabilities": capabilities,
        "priority": priority,
        "reason": reason,
    }


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
