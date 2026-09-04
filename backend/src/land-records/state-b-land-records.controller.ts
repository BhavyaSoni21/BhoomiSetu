import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, NotFoundException, HttpCode } from '@nestjs/common';
import { StateBLandRecordsService } from './state-b-land-records.service';
import { CreateStateBLandRecordDto, UpdateStateBLandRecordDto } from './dto/state-b-land-record.dto';

// Mock "State B" department API (Tech.md #13) - an urban plot-style land
// records system with different field names and units than State A's, on
// purpose (that mismatch is the interoperability challenge Phase 5's
// adapters will resolve).
@Controller('state-b/land-records')
export class StateBLandRecordsController {
  constructor(private readonly service: StateBLandRecordsService) {}

  @Post()
  create(@Body() dto: CreateStateBLandRecordDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('plot_id') plotId?: string,
    @Query('locality_id') localityId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.service.findAll({ plotId, localityId, limit, offset });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const record = await this.service.findOne(id);
    if (!record) throw new NotFoundException(`State B land record not found: ${id}`);
    return record;
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStateBLandRecordDto) {
    const record = await this.service.update(id, dto);
    if (!record) throw new NotFoundException(`State B land record not found: ${id}`);
    return record;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.service.remove(id);
    if (!deleted) throw new NotFoundException(`State B land record not found: ${id}`);
  }
}
