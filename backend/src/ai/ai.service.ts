import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { CitizenParcel } from '../parcels/citizen-parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { PlanningRecord } from '../departments/planning-record.entity';
import { RegistrationRecord } from '../departments/registration-record.entity';
import { ResponseAggregatorService } from '../interoperability/response-aggregator.service';
import { GovernanceAlertsService } from '../governance/governance-alerts.service';
import { GroqService } from './groq.service';
import { assistantResponseSchema, AssistantFilters } from './schemas/assistant-response.schema';
import { aiExplanationSchema, AiExplanation } from './schemas/ai-explanation.schema';
import { User } from '../users/user.entity';
import { ALL_STAFF_ROLES, CITIZEN_ROLE } from '../auth/roles.constants';

// The floating "Ask AI" widget (docs/Plan.md's citizen-assistant addendum)
// handles two kinds of question in a single Groq call, rather than a
// separate classification round trip first - that would double the latency
// the widget is specifically trying to avoid.
const ASSISTANT_SYSTEM_PROMPT = `You are BhoomiSetu's citizen assistant, embedded as a chat widget on the Citizen Portal. You ONLY help with two things:

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
User message: "मुझे एक कविता लिखो" -> {"intent":"HELP","reply":"मैं केवल भूमिसेतु पर भूखंड और भूमि-अभिलेख से जुड़े सवालों में, और वेबसाइट का उपयोग करने में मदद कर सकता हूं।"}`;

const RESULT_LIMIT = 50;

// The AI naturally extracts a state/district the way the user phrased it
// (e.g. "Pune", "Maharashtra"), but seed.ts stores parcels under short codes
// (districtCode = the first 3 letters of the district name, uppercased -
// see districtCode() in seed.ts; stateCode is one of MH/TN/KA/DL). Tech.md
// #29.1 puts "the backend then executes the actual database query" - this is
// that step normalizing the AI's free-form value into the code this mock's
// data actually uses, rather than the query silently matching nothing.
const STATE_NAME_TO_CODE: Record<string, string> = {
  MAHARASHTRA: 'MH',
  'TAMIL NADU': 'TN',
  KARNATAKA: 'KA',
  DELHI: 'DL',
  'NEW DELHI': 'DL',
};

function normalizeStateCode(value: string): string {
  const upper = value.trim().toUpperCase();
  return STATE_NAME_TO_CODE[upper] ?? upper;
}

function normalizeDistrictCode(value: string): string {
  return value.trim().substring(0, 3).toUpperCase();
}

export type ExplainResult = AiExplanation | 'NOT_FOUND';

// Tech.md #28-#32 / Plan.md Phase 8. The AI service only ever: converts a
// query to a structured filter the backend then executes itself (#29.1,
// "the LLM must never directly execute unrestricted SQL"), or summarizes/
// explains data that already exists. It never writes to any record - see
// AI SECURITY RULES (#32).
@Injectable()
export class AiService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(TaxRecord) private readonly taxRepository: Repository<TaxRecord>,
    @InjectRepository(RestrictionRecord) private readonly restrictionRepository: Repository<RestrictionRecord>,
    @InjectRepository(PlanningRecord) private readonly planningRepository: Repository<PlanningRecord>,
    @InjectRepository(RegistrationRecord) private readonly registrationRepository: Repository<RegistrationRecord>,
    @InjectRepository(CitizenParcel) private readonly citizenParcelRepository: Repository<CitizenParcel>,
    private readonly groqService: GroqService,
    private readonly responseAggregatorService: ResponseAggregatorService,
    private readonly governanceAlertsService: GovernanceAlertsService,
  ) {}

  async askAssistant(query: string): Promise<{
    intent: 'DATA_QUERY' | 'HELP';
    reply: string;
    filters?: AssistantFilters;
    totalMatches?: number;
    results?: Parcel[];
  }> {
    const raw = await this.groqService.completeJson(ASSISTANT_SYSTEM_PROMPT, query);
    const parsed = assistantResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadGatewayException('AI returned a response that could not be validated');
    }
    const { intent, reply, filters } = parsed.data;

    // A HELP answer (or a DATA_QUERY the model somehow returned with no
    // filters at all) needs no database work - just the conversational reply.
    if (intent === 'HELP' || !filters) {
      return { intent: 'HELP', reply };
    }

    let parcels = await this.parcelRepository.find({
      where: {
        ...(filters.state ? { stateCode: normalizeStateCode(filters.state) } : {}),
        ...(filters.district ? { districtCode: normalizeDistrictCode(filters.district) } : {}),
      },
    });

    if (filters.tax_status) {
      const matchingParcelIds = new Set(
        (await this.taxRepository.find({ where: { taxStatus: filters.tax_status } })).map((r) => r.parcelId),
      );
      parcels = parcels.filter((p) => matchingParcelIds.has(p.id));
    }
    if (filters.has_restriction !== undefined) {
      const matchingParcelIds = new Set(
        (await this.restrictionRepository.find({ where: { hasRestriction: filters.has_restriction } })).map((r) => r.parcelId),
      );
      parcels = parcels.filter((p) => matchingParcelIds.has(p.id));
    }
    if (filters.land_use) {
      const matchingParcelIds = new Set(
        (await this.planningRepository.find({ where: { landUse: filters.land_use } })).map((r) => r.parcelId),
      );
      parcels = parcels.filter((p) => matchingParcelIds.has(p.id));
    }
    if (filters.registration_status) {
      const matchingParcelIds = new Set(
        (await this.registrationRepository.find({ where: { registrationStatus: filters.registration_status } })).map((r) => r.parcelId),
      );
      parcels = parcels.filter((p) => matchingParcelIds.has(p.id));
    }

    return { intent: 'DATA_QUERY', reply, filters, totalMatches: parcels.length, results: parcels.slice(0, RESULT_LIMIT) };
  }

  // Same rule as GET /parcels/:id/360 (ParcelsController.getParcel360) - a
  // viewer who isn't staff and isn't the citizen this parcel is associated
  // with never sees Planning/Tax/Restriction/Dispute/Encumbrance, so an AI
  // summary can't leak them either. A small duplicate of
  // ParcelsService.isCitizenAssociatedWithParcel rather than a cross-module
  // call - see ai.module.ts's comment on CitizenParcel.
  private async canViewRestrictedDepartments(user: User | undefined, parcelId: string): Promise<boolean> {
    if (user && (ALL_STAFF_ROLES as readonly string[]).includes(user.role)) return true;
    if (user?.role === CITIZEN_ROLE) {
      const link = await this.citizenParcelRepository.findOne({ where: { citizen: { id: user.id }, parcel: { id: parcelId } } });
      return link !== null;
    }
    return false;
  }

  async explainParcel(parcelId: string, user: User | undefined): Promise<ExplainResult> {
    const parcel360 = await this.responseAggregatorService.buildParcel360(parcelId);
    if (!parcel360) return 'NOT_FOUND';

    if (!(await this.canViewRestrictedDepartments(user, parcelId))) {
      parcel360.departments.planning = null;
      parcel360.departments.tax = null;
      parcel360.departments.restriction = null;
      parcel360.departments.dispute = null;
      parcel360.departments.encumbrance = null;
    }

    const systemPrompt = `You explain a land parcel's aggregated records to a citizen in plain, simple language. Respond with ONLY a JSON object of this exact shape:
{"summary": string, "risk_level": "LOW"|"MEDIUM"|"HIGH", "findings": [{"type": string, "description": string}], "recommended_action": string}
Base findings strictly on the data given - do not invent facts, ownership changes, or legal conclusions. Some department fields may be null because they're withheld from this viewer, not because nothing was found - never claim or imply "no restrictions/disputes/encumbrances" for a null field.`;
    const raw = await this.groqService.completeJson(systemPrompt, JSON.stringify(parcel360));

    const parsed = aiExplanationSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadGatewayException('AI returned a parcel explanation that could not be validated');
    }
    return parsed.data;
  }

  async explainAlert(alertId: string): Promise<ExplainResult> {
    const alert = await this.governanceAlertsService.findOne(alertId);
    if (!alert) return 'NOT_FOUND';

    const systemPrompt = `You explain a land-governance alert to an officer in plain language (Tech.md #29.3 style). Respond with ONLY a JSON object of this exact shape:
{"summary": string, "risk_level": "LOW"|"MEDIUM"|"HIGH", "findings": [{"type": string, "description": string}], "recommended_action": string}
Base this strictly on the alert data given - never approve, dismiss, or make a legal determination yourself; recommended_action should describe what an officer should check, not a final decision.`;
    const raw = await this.groqService.completeJson(
      systemPrompt,
      JSON.stringify({
        alertType: alert.alertType,
        severity: alert.severity,
        source: alert.source,
        explanation: alert.explanation,
        parcelId: alert.parcelId,
      }),
    );

    const parsed = aiExplanationSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadGatewayException('AI returned an alert explanation that could not be validated');
    }
    return parsed.data;
  }
}
