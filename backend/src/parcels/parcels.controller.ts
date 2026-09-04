import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ParcelsService } from './parcels.service';

@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Get()
  async searchParcels(
    @Query('ulpin') ulpin?: string,
    @Query('survey_number') surveyNumber?: string,
    @Query('plot_number') plotNumber?: string,
    @Query('local_identifier') localIdentifier?: string,
    @Query('state') state?: string,
    @Query('district') district?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.parcelsService.searchParcels({
      ulpin,
      surveyNumber,
      plotNumber,
      localIdentifier,
      state,
      district,
      limit,
      offset,
    });
  }

  @Get(':id')
  async getParcel(@Param('id', ParseUUIDPipe) id: string) {
    return this.parcelsService.findOne(id);
  }

  @Get(':id/360')
  async getParcel360(@Param('id', ParseUUIDPipe) id: string) {
    // This will be expanded in later phases to include data from all departments
    const parcel = await this.parcelsService.findOne(id);
    if (!parcel) {
      return null;
    }

    // Basic parcel 360 structure - will be enhanced in Phase 2
    return {
      parcel: parcel,
      // In Phase 2, this will include data from land records, registration, planning, tax, restriction departments
      departments: {
        landRecords: null, // To be populated in Phase 2
        registration: null, // To be populated in Phase 2
        planning: null, // To be populated in Phase 2
        tax: null, // To be populated in Phase 2
        restriction: null, // To be populated in Phase 2
      }
    };
  }
}