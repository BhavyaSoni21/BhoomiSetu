import { Controller, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { RestrictionService } from './restriction.service';

// Mock Restriction Department API (Tech.md #16.5) - a per-parcel business
// record, distinct from the GIS spatial restriction overlay at
// GET /api/v1/gis/parcels/:id/restrictions.
@Controller('restriction')
export class RestrictionController {
  constructor(private readonly service: RestrictionService) {}

  @Get(':parcelId')
  async getByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const record = await this.service.findByParcelId(parcelId);
    if (!record) throw new NotFoundException(`No restriction record for parcel: ${parcelId}`);
    return record;
  }
}
