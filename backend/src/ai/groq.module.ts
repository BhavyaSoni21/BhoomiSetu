import { Module } from '@nestjs/common';
import { GroqService } from './groq.service';

// Extracted from AiModule (2026-09-09) so WorkflowsModule's request-routing
// feature can use GroqService without pulling in all of AiModule
// (AiController, AiService, InteroperabilityModule, GovernanceModule, and 4
// department repos it only needs for its own /ai/query feature). GroqService
// itself is unchanged - a pure leaf provider with no dependencies of its own.
@Module({
  providers: [GroqService],
  exports: [GroqService],
})
export class GroqModule {}
