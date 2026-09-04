import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto, UpdateWorkflowStatusDto } from './dto/workflow.dto';

// Tech.md #23 Workflow API - citizen service requests (Phase 6) and, later,
// the officer review actions that advance them (Phase 7) both go through
// this same endpoint set.
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  async create(@Body() dto: CreateWorkflowDto) {
    const result = await this.workflowsService.create(dto);
    if (result === 'PARCEL_NOT_FOUND') {
      throw new BadRequestException(`Parcel not found: ${dto.parcelId}`);
    }
    return result;
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const workflow = await this.workflowsService.findOne(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow not found: ${id}`);
    }
    return workflow;
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkflowStatusDto) {
    const workflow = await this.workflowsService.updateStatus(id, dto);
    if (!workflow) {
      throw new NotFoundException(`Workflow not found: ${id}`);
    }
    return workflow;
  }
}
