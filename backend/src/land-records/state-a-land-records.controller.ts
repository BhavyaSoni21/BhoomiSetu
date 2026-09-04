import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, NotFoundException, HttpCode } from '@nestjs/common';
import { StateALandRecordsService } from './state-a-land-records.service';
import { CreateStateALandRecordDto, UpdateStateALandRecordDto } from './dto/state-a-land-record.dto';

// Mock "State A" department API (Tech.md #12) - a rural/revenue-village
// style land records system, independent of State B's and of the canonical
// parcel model. Query params use the schema's own field names
// (survey_number, village_code), not the canonical identifiers used
// elsewhere in the API.
@Controller('state-a/land-records')
export class StateALandRecordsController {
  constructor(private readonly service: StateALandRecordsService) {}

  @Post()
  create(@Body() dto: CreateStateALandRecordDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('survey_number') surveyNumber?: string,
    @Query('village_code') villageCode?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.service.findAll({ surveyNumber, villageCode, limit, offset });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const record = await this.service.findOne(id);
    if (!record) throw new NotFoundException(`State A land record not found: ${id}`);
    return record;
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStateALandRecordDto) {
    const record = await this.service.update(id, dto);
    if (!record) throw new NotFoundException(`State A land record not found: ${id}`);
    return record;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.service.remove(id);
    if (!deleted) throw new NotFoundException(`State A land record not found: ${id}`);
  }
}
