import { Controller, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { DisputeService } from './dispute.service';

// Mock Dispute Department API - a per-parcel business record, same pattern
// as the other four mock departments in this module.
@Controller('dispute')
export class DisputeController {
  constructor(private readonly service: DisputeService) {}

  @Get(':parcelId')
  async getByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const record = await this.service.findByParcelId(parcelId);
    if (!record) throw new NotFoundException(`No dispute record for parcel: ${parcelId}`);
    return record;
  }
}
