import { Controller, Get, Query, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { ResponseAggregatorService } from '../interoperability/response-aggregator.service';
import { WorkflowsService } from '../workflows/workflows.service';

@Controller('parcels')
export class ParcelsController {
  constructor(
    private readonly parcelsService: ParcelsService,
    private readonly responseAggregatorService: ResponseAggregatorService,
    private readonly workflowsService: WorkflowsService,
  ) {}

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

  @Get(':id/geometry')
  async getParcelGeometry(@Param('id', ParseUUIDPipe) id: string) {
    const geometry = await this.parcelsService.getGeometry(id);
    if (!geometry) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return geometry;
  }

  @Get(':id/neighbours')
  async getNeighbours(@Param('id', ParseUUIDPipe) id: string, @Query('distance') distance?: string) {
    const result = await this.parcelsService.getNeighbours(id, distance !== undefined ? Number(distance) : undefined);
    if (!result) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return result;
  }

  @Get(':id/context')
  async getContext(@Param('id', ParseUUIDPipe) id: string, @Query('distance') distance?: string) {
    const result = await this.parcelsService.getContext(id, distance !== undefined ? Number(distance) : undefined);
    if (!result) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return result;
  }

  @Get(':id/workflows')
  async getWorkflows(@Param('id', ParseUUIDPipe) id: string) {
    const parcel = await this.parcelsService.findOne(id);
    if (!parcel) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return this.workflowsService.findByParcel(id);
  }

  @Get(':id/360')
  async getParcel360(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.responseAggregatorService.buildParcel360(id);
    if (!result) {
      throw new NotFoundException(`Parcel not found with id: ${id}`);
    }
    return result;
  }
}