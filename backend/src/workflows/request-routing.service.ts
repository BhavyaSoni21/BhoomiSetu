import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from '../ai/groq.service';
import { DEPARTMENT_ROLE } from '../auth/roles.constants';

export interface PipelineStage {
  department: string;
  assignedRole: string;
}

export interface RoutingResult {
  pipeline: PipelineStage[];
  routingNotes: string | null;
}

const DEPARTMENT_DESCRIPTIONS: Record<string, string> = {
  LAND_RECORDS: 'Survey numbers, ownership records, and title documentation.',
  REGISTRATION: 'Property registration and transaction recording.',
  PLANNING: 'Zoning classification, land use, and master plan oversight.',
  TAX: 'Property tax assessment and collection.',
  RESTRICTION: 'Environmental, protected-area, and other land-use restrictions.',
  DISPUTE: 'Ownership, boundary, inheritance, and encroachment dispute resolution.',
  ENCUMBRANCE: 'Mortgages, liens, and other charges registered against a parcel.',
};

const VALID_DEPARTMENTS = Object.keys(DEPARTMENT_DESCRIPTIONS);

const SYSTEM_PROMPT = `You are BhoomiSetu's request-routing assistant. A citizen has raised a service request against a land parcel; your job is to decide which department(s) should review it, based only on the request type and its free-text details.

Departments and what each one handles:
${VALID_DEPARTMENTS.map((code) => `- ${code}: ${DEPARTMENT_DESCRIPTIONS[code]}`).join('\n')}

Respond with ONLY a JSON object of this exact shape:
{"departments": string[], "reason": string}

"departments" must be a non-empty array using ONLY the department codes listed above, in the order they should review the request (most relevant first). Pick every department the request genuinely concerns - most requests need only one, but a request that touches more than one area (e.g. a correction that's really a dispute) may need more. "reason" is one short sentence explaining the choice, written for the officer who will see it (e.g. "Concerns an unpaid tax bill mentioned in the request details.").

Never invent a department code that isn't in the list above.`;

// Replaces the deterministic pipeline (pipelineFor() in workflows.service.ts)
// as the PRIMARY routing mechanism when the AI is available and returns a
// valid result - "if a request is posted it will be analysed with the help
// of ai and then sent to the respective departments" (the user's own
// framing). The deterministic pipeline is the guaranteed fallback: on any
// failure (unconfigured, transport error, malformed/empty JSON, or every
// returned code failing validation), this returns an empty pipeline and the
// caller falls back to pipelineFor() unchanged - request submission never
// breaks or hangs on AI, matching NarrativeService's established
// swallow-to-fallback discipline elsewhere in this codebase.
@Injectable()
export class RequestRoutingService {
  private readonly logger = new Logger(RequestRoutingService.name);

  constructor(private readonly groqService: GroqService) {}

  async suggestPipeline(workflowType: string, requestDetails: string | null | undefined): Promise<RoutingResult> {
    if (!requestDetails || requestDetails.trim().length === 0) {
      return { pipeline: [], routingNotes: null };
    }

    try {
      const userPrompt = `Request type: ${workflowType}\nRequest details: ${requestDetails}`;
      const raw = await this.groqService.completeJson(SYSTEM_PROMPT, userPrompt);
      return this.parseResult(raw);
    } catch (error) {
      this.logger.warn(`AI request routing failed, falling back to the default pipeline: ${(error as Error).message}`);
      return { pipeline: [], routingNotes: null };
    }
  }

  private parseResult(raw: unknown): RoutingResult {
    if (typeof raw !== 'object' || raw === null || !('departments' in raw) || !Array.isArray((raw as { departments: unknown }).departments)) {
      return { pipeline: [], routingNotes: null };
    }

    const departments = (raw as { departments: unknown[] }).departments;
    const reason = (raw as { reason?: unknown }).reason;

    const validCodes = [...new Set(departments.filter((code): code is string => typeof code === 'string' && VALID_DEPARTMENTS.includes(code)))];
    if (validCodes.length === 0) {
      return { pipeline: [], routingNotes: null };
    }

    const pipeline = validCodes.map((department) => ({ department, assignedRole: DEPARTMENT_ROLE[department] }));
    return { pipeline, routingNotes: typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : null };
  }
}
