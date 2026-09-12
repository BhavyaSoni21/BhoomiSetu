import { Controller, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { TaxService } from './tax.service';

// Mock Tax Department API (Tech.md #16.4).
@Controller('tax')
export class TaxController {
  constructor(private readonly service: TaxService) {}

  @Get(':parcelId')
  async getByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const record = await this.service.findByParcelId(parcelId);
    if (!record) throw new NotFoundException(`No tax record for parcel: ${parcelId}`);
    return record;
  }
}
