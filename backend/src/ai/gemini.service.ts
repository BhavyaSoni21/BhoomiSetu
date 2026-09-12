import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Gemini AI fallback service. Used by GroqService when Groq/OpenRouter hits a
// rate limit (HTTP 429) or is unavailable. Uses the same completeJson()
// interface as GroqService so the caller (AiService) needs no changes.
//
// Model: GEMINI_MODEL env var (default: gemini-3.8-flash).
// API key: GEMINI_API_KEY env var. Leave blank to disable - GroqService will
// simply re-throw the original Groq error rather than falling back.
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genai: GoogleGenerativeAI | null;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || null;
    this.genai = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }

  get isConfigured(): boolean {
    return this.genai !== null;
  }

  // Same contract as GroqService.completeJson(): asks the model for a JSON
  // object, parses and returns it. Zod validation of the shape happens one
  // level up in AiService, not here.
  async completeJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
    if (!this.genai) {
      throw new ServiceUnavailableException('Gemini fallback is not configured (GEMINI_API_KEY is not set)');
    }

    const model = this.genai.getGenerativeModel({
      model: this.modelName,
      // Safety settings relaxed just enough for land-governance data (the
      // default BLOCK_MEDIUM_AND_ABOVE blocks legitimate but rare edge cases
      // like dispute descriptions containing violence-adjacent legal language).
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    // Gemini uses a combined system+user prompt pattern for chat completions.
    const result = await model.generateContent(
      `${systemPrompt}\n\n---\n\nUser message:\n${userPrompt}`,
    );

    const text = result.response.text();
    if (!text) {
      throw new ServiceUnavailableException('Gemini returned an empty response');
    }

    // Strip markdown fences if the model wraps the JSON in ```json ... ```
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      this.logger.log(`Gemini fallback succeeded (model: ${this.modelName})`);
      return parsed;
    } catch {
      throw new ServiceUnavailableException('Gemini returned malformed JSON');
    }
  }
}
