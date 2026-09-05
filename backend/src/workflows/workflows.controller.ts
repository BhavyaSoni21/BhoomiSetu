import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto, ReviewWorkflowStepDto, UpdateWorkflowStatusDto } from './dto/workflow.dto';

// Tech.md #23 Workflow API - citizen service requests (Phase 6) and the
// officer review actions that advance them (Phase 7) both go through this
// same endpoint set. GET (list) and the steps/:stepId review action are
// Phase 7 additions beyond Tech.md's literal 4 endpoints, needed to actually
// drive an officer dashboard and per-step review off this schema.
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

  @Get()
  async findAll(@Query('department') department?: string, @Query('stepStatus') stepStatus?: string) {
    return this.workflowsService.findAll({ department, stepStatus });
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

  @Patch(':workflowId/steps/:stepId')
  async reviewStep(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: ReviewWorkflowStepDto,
  ) {
    const result = await this.workflowsService.reviewStep(workflowId, stepId, dto);
    if (result === 'WORKFLOW_NOT_FOUND') {
      throw new NotFoundException(`Workflow not found: ${workflowId}`);
    }
    if (result === 'STEP_NOT_FOUND') {
      throw new NotFoundException(`Workflow step not found: ${stepId}`);
    }
    if (result === 'STEP_ALREADY_DECIDED') {
      throw new BadRequestException('This workflow step has already been decided');
    }
    return result;
  }
}
