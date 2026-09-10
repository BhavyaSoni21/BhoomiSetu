import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { GeminiService } from './gemini.service';

// Tech.md #28: "Groq should be integrated only through the backend". Groq's API
// is OpenAI-compatible (Plan.md Phase 8), so this wraps the `openai` package
// pointed at Groq's base URL. GROQ_API_KEY is read from the environment only.
//
// Gemini fallback: if Groq returns HTTP 429 (rate/quota limit) or is
// unavailable, completeJson() automatically retries via GeminiService before
// giving up - transparent to AiService/the rest of the app.
@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(private readonly geminiService: GeminiService) {
    const apiKey = process.env.GROQ_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' }) : null;
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  }

  // Tech.md #30's "STRUCTURED JSON" step - asks the model for a JSON object
  // and parses it. Zod validation of the *shape* the caller actually needs
  // happens one level up (ai.service.ts), not here - this method only
  // guarantees valid JSON came back, not that it matches any schema.
  //
  // Fallback order:
  //   1. Groq (primary) — skipped if GROQ_API_KEY is unset
  //   2. Gemini (fallback) — used when Groq returns 429 or throws a
  //      ServiceUnavailableException (e.g. GROQ_API_KEY unset or quota hit)
  //      Skipped if GEMINI_API_KEY is also unset.
  async completeJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
    // --- Primary: Groq ---
    if (this.client) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new ServiceUnavailableException('Groq returned an empty response');
        }

        try {
          return JSON.parse(content);
        } catch {
          throw new ServiceUnavailableException('Groq returned malformed JSON');
        }
      } catch (err: unknown) {
        const isQuota = this.isRateLimitError(err);
        if (isQuota) {
          this.logger.warn('Groq rate/quota limit hit - falling back to Gemini');
        } else if (err instanceof ServiceUnavailableException) {
          this.logger.warn(`Groq unavailable (${err.message}) - falling back to Gemini`);
        } else {
          // Unexpected Groq error (network, bad model name, etc.) - also try
          // Gemini before failing, since the citizen is already waiting.
          this.logger.warn(`Groq error - falling back to Gemini. Cause: ${String(err)}`);
        }
        // Fall through to Gemini below.
      }
    }

    // --- Fallback: Gemini ---
    if (this.geminiService.isConfigured) {
      return this.geminiService.completeJson(systemPrompt, userPrompt);
    }

    // Both providers unavailable.
    throw new ServiceUnavailableException(
      'AI service is not available (GROQ_API_KEY is not set or quota exceeded, and GEMINI_API_KEY fallback is not configured)',
    );
  }

  // Detects HTTP 429 / rate-limit errors from the openai SDK. The SDK wraps
  // them as APIStatusError with status 429, or an error whose message
  // contains "rate_limit" / "quota".
  private isRateLimitError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as { status?: number; message?: string; code?: string };
    if (e.status === 429) return true;
    const msg = (e.message ?? '').toLowerCase();
    return msg.includes('rate_limit') || msg.includes('quota') || msg.includes('rate limit');
  }
}
