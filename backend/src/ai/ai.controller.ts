import { Controller, Post, Body, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { NaturalLanguageQueryDto } from './dto/natural-language-query.dto';

// Tech.md #31 Groq AI endpoints.
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('query')
  async query(@Body() dto: NaturalLanguageQueryDto) {
    return this.aiService.naturalLanguageQuery(dto.query);
  }

  @Post('parcels/:parcelId/explain')
  async explainParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const result = await this.aiService.explainParcel(parcelId);
    if (result === 'NOT_FOUND') throw new NotFoundException(`Parcel not found: ${parcelId}`);
    return result;
  }

  @Post('alerts/:alertId/explain')
  async explainAlert(@Param('alertId', ParseUUIDPipe) alertId: string) {
    const result = await this.aiService.explainAlert(alertId);
    if (result === 'NOT_FOUND') throw new NotFoundException(`Governance alert not found: ${alertId}`);
    return result;
  }
}
