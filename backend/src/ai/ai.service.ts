import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { PlanningRecord } from '../departments/planning-record.entity';
import { RegistrationRecord } from '../departments/registration-record.entity';
import { ResponseAggregatorService } from '../interoperability/response-aggregator.service';
import { GovernanceAlertsService } from '../governance/governance-alerts.service';
import { GroqService } from './groq.service';
import { queryIntentSchema, QueryIntent } from './schemas/query-intent.schema';
import { aiExplanationSchema, AiExplanation } from './schemas/ai-explanation.schema';

const QUERY_SYSTEM_PROMPT = `You convert a citizen or officer's natural-language question about land parcels into a structured JSON filter. Respond with ONLY a JSON object of this exact shape:
{"filters": {"state"?: string, "district"?: string, "tax_status"?: "PAID"|"PENDING"|"OVERDUE", "has_restriction"?: boolean, "land_use"?: "RESIDENTIAL"|"COMMERCIAL"|"AGRICULTURAL"|"MIXED_USE", "registration_status"?: "REGISTERED"|"PENDING"|"NOT_REGISTERED"}}
Only include a key when the question actually asks about it. Never include any field not listed above. Never include SQL or any executable code - only this JSON filter object.`;

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
    private readonly groqService: GroqService,
    private readonly responseAggregatorService: ResponseAggregatorService,
    private readonly governanceAlertsService: GovernanceAlertsService,
  ) {}

  async naturalLanguageQuery(query: string): Promise<{ filters: QueryIntent['filters']; totalMatches: number; results: Parcel[] }> {
    const raw = await this.groqService.completeJson(QUERY_SYSTEM_PROMPT, query);
    const parsed = queryIntentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadGatewayException('AI returned a query interpretation that could not be validated');
    }
    const { filters } = parsed.data;

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

    return { filters, totalMatches: parcels.length, results: parcels.slice(0, RESULT_LIMIT) };
  }

  async explainParcel(parcelId: string): Promise<ExplainResult> {
    const parcel360 = await this.responseAggregatorService.buildParcel360(parcelId);
    if (!parcel360) return 'NOT_FOUND';

    const systemPrompt = `You explain a land parcel's aggregated records to a citizen in plain, simple language. Respond with ONLY a JSON object of this exact shape:
{"summary": string, "risk_level": "LOW"|"MEDIUM"|"HIGH", "findings": [{"type": string, "description": string}], "recommended_action": string}
Base findings strictly on the data given - do not invent facts, ownership changes, or legal conclusions.`;
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
