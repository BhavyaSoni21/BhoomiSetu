import { Controller, Get, Query } from '@nestjs/common';
import { SpatialService } from './spatial.service';

@Controller('gis')
export class SpatialController {
  constructor(private readonly spatialService: SpatialService) {}

  @Get('zoning-overlays')
  async getZoningOverlays(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findZoningOverlays({ state, district });
  }

  @Get('restriction-zones')
  async getRestrictionZones(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findRestrictionZones({ state, district });
  }

  @Get('infrastructure')
  async getInfrastructure(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findInfrastructure({ state, district });
  }

  @Get('change-detection-events')
  async getChangeDetectionEvents(@Query('state') state?: string, @Query('district') district?: string) {
    return this.spatialService.findChangeDetectionEvents({ state, district });
  }
}
