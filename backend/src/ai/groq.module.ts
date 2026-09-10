import { Module } from '@nestjs/common';
import { GroqService } from './groq.service';
import { GeminiService } from './gemini.service';

// Extracted from AiModule (2026-09-09) so WorkflowsModule's request-routing
// feature can use GroqService without pulling in all of AiModule
// (AiController, AiService, InteroperabilityModule, GovernanceModule, and 4
// department repos it only needs for its own /ai/query feature).
//
// GeminiService is registered here as a provider so GroqService can inject
// it as a fallback when Groq hits a rate/quota limit (2026-09-10).
@Module({
  providers: [GeminiService, GroqService],
  exports: [GroqService],
})
export class GroqModule {}
