import { Controller, Post, Body, Param, ParseUUIDPipe, NotFoundException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { NaturalLanguageQueryDto } from './dto/natural-language-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ALL_STAFF_ROLES } from '../auth/roles.constants';

// Tech.md #31 Groq AI endpoints. Tighter rate limit than the app default
// (see AppModule) - every request here costs a real Groq API call.
@Controller('ai')
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // Citizen-facing (the floating "Ask AI" widget on the Citizen Portal) -
  // stays public. Handles both a data question ("parcels with overdue tax")
  // and a how-do-I-use-this-site question in one call - see
  // AiService.askAssistant.
  @Post('query')
  async query(@Body() dto: NaturalLanguageQueryDto) {
    return this.aiService.askAssistant(dto.query);
  }

  // Citizen-facing ("Explain with AI" on Parcel 360, a shared route) - stays public.
  @Post('parcels/:parcelId/explain')
  async explainParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const result = await this.aiService.explainParcel(parcelId);
    if (result === 'NOT_FOUND') throw new NotFoundException(`Parcel not found: ${parcelId}`);
    return result;
  }

  // Officer-only (GovernanceAlertsPanel's "Explain" button) - governance
  // alerts have no citizen-facing surface at all (docs/FEATURE_AUDIT.md §8 item 5).
  @Post('alerts/:alertId/explain')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async explainAlert(@Param('alertId', ParseUUIDPipe) alertId: string) {
    const result = await this.aiService.explainAlert(alertId);
    if (result === 'NOT_FOUND') throw new NotFoundException(`Governance alert not found: ${alertId}`);
    return result;
  }
}
