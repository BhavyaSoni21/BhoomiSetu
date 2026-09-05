import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';

// Tech.md #28: "Groq should be integrated only through the backend" - this is
// the one place in the codebase that talks to Groq. Groq's API is
// OpenAI-compatible (Plan.md Phase 8: "Node.js with OpenAI-compatible SDK"),
// so this wraps the official `openai` package pointed at Groq's base URL
// rather than a Groq-specific SDK. GROQ_API_KEY is read from the environment
// only (never touches frontend code or a request), per Tech.md #28's rule.
@Injectable()
export class GroqService {
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' }) : null;
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  }

  // Tech.md #30's "STRUCTURED JSON" step - asks the model for a JSON object
  // and parses it. Zod validation of the *shape* the caller actually needs
  // happens one level up (ai.service.ts), not here - this method only
  // guarantees valid JSON came back, not that it matches any schema.
  async completeJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
    if (!this.client) {
      throw new ServiceUnavailableException('AI service is not configured (GROQ_API_KEY is not set)');
    }

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
      throw new ServiceUnavailableException('AI service returned an empty response');
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new ServiceUnavailableException('AI service returned malformed JSON');
    }
  }
}
