import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ParcelCategory } from '../common/parcel-generation/parcel-category';

export interface ParcelChangeFact {
  canonicalParcelId: string;
  fromCategory: ParcelCategory;
  toCategory: ParcelCategory;
  // A short, factual, already-true sentence about *why* (the real dispute/
  // restriction record behind the category) - the LLM is asked to phrase
  // this for a reader, not to invent it, so a hallucinated cause can never
  // reach a GovernanceAlert's explanation text.
  facts: string;
}

// Historical parcel-imagery comparison (docs/FRONTEND_UPGRADE_SPEC.md §8,
// redesigned 2026-09-08 per the user's follow-up: "remove the pixel
// difference feature... use the llm for finding the differenced... I want
// the output as there is this dispute in this parcel"). Same OpenAI-
// compatible OpenRouter client the old VisionService used (GroqService's own
// model doesn't take image input, so this stays independent of
// GROQ_API_KEY) - renamed from VisionService once it stopped taking image
// input at all: a live latency test measured a 10-parcel call at ~62-95s
// WITH the two snapshot images attached vs ~11s for the identical prompt
// text-only. Since the LLM's job is only to phrase already-known facts
// (real DisputeRecord/ParcelHistoricalState data, never to visually detect
// anything - that's a plain data comparison, see categoryFor in
// parcel-category.ts), the images added 5-8x the latency for zero new
// information, so they're not sent here any more; the images stay in the
// UI for humans, they just don't need to reach the LLM call at all.
@Injectable()
export class NarrativeService {
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' }) : null;
    this.model = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  }

  async explainParcelChanges(fromYear: number, toYear: number, parcels: ParcelChangeFact[]): Promise<Map<string, string>> {
    if (!this.client) {
      throw new ServiceUnavailableException('Narrative AI service is not configured (OPENROUTER_API_KEY is not set)');
    }
    if (parcels.length === 0) return new Map();

    const factLines = parcels
      .map((p) => `- ${p.canonicalParcelId}: was "${p.fromCategory}" in ${fromYear}, is now "${p.toCategory}" in ${toYear}. ${p.facts}`)
      .join('\n');

    const prompt =
      `The following land parcels have a real, documented change on file between ${fromYear} and ${toYear}:\n${factLines}\n\n` +
      'For each parcel listed above, write exactly one short, plain-language sentence for a land officer explaining what ' +
      'the situation is now - state the real fact given, do not invent details beyond it. Reply with exactly one line per ' +
      'parcel, formatted as "<parcel id>: <sentence>", nothing else before or after.';

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException('Narrative AI service returned an empty response');
    }
    return parseNarratives(content, parcels);
  }
}

// Lenient line-based parsing (not strict JSON) - free/small models are
// unreliable at strict JSON formatting, and a per-parcel fallback template
// is only a caller's data lookup away, so a partially-parsed response still
// leaves every parcel with a real explanation either way.
function parseNarratives(content: string, parcels: ParcelChangeFact[]): Map<string, string> {
  const knownIds = new Set(parcels.map((p) => p.canonicalParcelId));
  const result = new Map<string, string>();
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/^[-*\d.\s]+/, '').trim();
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const id = line.slice(0, separatorIndex).trim();
    const sentence = line.slice(separatorIndex + 1).trim();
    if (knownIds.has(id) && sentence.length > 0) {
      result.set(id, sentence);
    }
  }
  return result;
}
