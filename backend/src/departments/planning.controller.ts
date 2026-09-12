import { Controller, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { PlanningService } from './planning.service';

// Mock Planning Department API (Tech.md #16.3).
@Controller('planning')
export class PlanningController {
  constructor(private readonly service: PlanningService) {}

  @Get(':parcelId')
  async getByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const record = await this.service.findByParcelId(parcelId);
    if (!record) throw new NotFoundException(`No planning record for parcel: ${parcelId}`);
    return record;
  }
}
