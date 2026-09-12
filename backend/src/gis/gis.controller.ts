import { Controller, Get, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { GisService } from './gis.service';

@Controller('gis')
export class GisController {
  constructor(private readonly gisService: GisService) {}

  @Get('parcels')
  async getParcels(
    @Query('bbox') bbox?: string,
    @Query('zoom') zoom?: number,
    @Query('state') state?: string,
    @Query('district') district?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    let parsedBbox: [number, number, number, number] | undefined = undefined;
    if (bbox) {
      const nums = bbox.split(',').map(Number);
      if (nums.length === 4) {
        parsedBbox = nums as [number, number, number, number];
      }
    }
    return this.gisService.findAll({
      bbox: parsedBbox,
      zoom,
      state,
      district,
      limit,
      offset,
    });
  }

  @Get('parcels/:id/geometry')
  async getParcelGeometry(@Param('id', ParseUUIDPipe) id: string) {
    return this.gisService.getGeometry(id);
  }

  @Get('parcels/:id/restrictions')
  async getParcelRestrictions(@Param('id', ParseUUIDPipe) id: string) {
    return this.gisService.getRestrictions(id);
  }
}