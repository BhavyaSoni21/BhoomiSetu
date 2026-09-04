import { Controller, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { RegistrationService } from './registration.service';

// Mock Registration Department API (Tech.md #16.2), independent of the other
// four department mocks and of the canonical parcel model.
@Controller('registration')
export class RegistrationController {
  constructor(private readonly service: RegistrationService) {}

  @Get(':parcelId')
  async getByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    const record = await this.service.findByParcelId(parcelId);
    if (!record) throw new NotFoundException(`No registration record for parcel: ${parcelId}`);
    return record;
  }
}
