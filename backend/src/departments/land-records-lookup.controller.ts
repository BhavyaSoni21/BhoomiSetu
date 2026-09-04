import { Controller, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { LandRecordsLookupService } from './land-records-lookup.service';

// Mock Land Records Department API (Tech.md #16.1). Distinct from
// GET /api/v1/state-a|state-b/land-records/:id (Phase 3's raw schema CRUD) -
// this endpoint takes a *parcel* id and resolves it to whichever
// state-specific record applies.
@Controller('land-records')
export class LandRecordsLookupController {
  constructor(private readonly service: LandRecordsLookupService) {}

  @Get(':parcelId')
  async getByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const result = await this.service.findByParcelId(parcelId);
    if (result === 'PARCEL_NOT_FOUND') {
      throw new NotFoundException(`Parcel not found: ${parcelId}`);
    }
    if (!result) {
      throw new NotFoundException(`No land record could be resolved for parcel: ${parcelId}`);
    }
    return result;
  }
}
