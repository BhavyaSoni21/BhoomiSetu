import { Controller, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { EncumbranceService } from './encumbrance.service';

// Mock Encumbrance/Mortgage Department API - a per-parcel business record,
// same pattern as the other mock departments in this module.
@Controller('encumbrance')
export class EncumbranceController {
  constructor(private readonly service: EncumbranceService) {}

  @Get(':parcelId')
  async getByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const record = await this.service.findByParcelId(parcelId);
    if (!record) throw new NotFoundException(`No encumbrance record for parcel: ${parcelId}`);
    return record;
  }
}
