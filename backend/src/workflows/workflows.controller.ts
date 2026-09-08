import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, NotFoundException, BadRequestException, ForbiddenException, UseGuards } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto, ReviewWorkflowStepDto, UpdateWorkflowStatusDto } from './dto/workflow.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ALL_STAFF_ROLES, CITIZEN_ROLE, ROLE_DEPARTMENT } from '../auth/roles.constants';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';

// Tech.md #23 Workflow API - citizen service requests (Phase 6) and the
// officer review actions that advance them (Phase 7) both go through this
// same endpoint set. GET (list) and the steps/:stepId review action are
// Phase 7 additions beyond Tech.md's literal 4 endpoints, needed to actually
// drive an officer dashboard and per-step review off this schema.
//
// create() now requires a signed-in CITIZEN (docs/flow.md §9 - filing a
// request moved from anonymous/public to account-gated now that real citizen
// accounts exist end-to-end). Everything else here is officer/admin-only
// (§8 item 5).
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE)
  async create(@CurrentUser() user: User, @Body() dto: CreateWorkflowDto) {
    // Raise Request restricted to the citizen's own parcels
    // (docs/FRONTEND_UPGRADE_SPEC.md §4). Existence is checked before
    // association - same ordering as ParcelsController's
    // GET /:id/ownership-history - so a bogus parcel id still gets create()'s
    // existing 400 rather than being swallowed into a 403.
    const parcelExists = await this.workflowsService.parcelExists(dto.parcelId);
    if (!parcelExists) {
      throw new BadRequestException(`Parcel not found: ${dto.parcelId}`);
    }
    const associated = await this.workflowsService.isCitizenAssociatedWithParcel(user.id, dto.parcelId);
    if (!associated) {
      throw new ForbiddenException('You can only raise a request for a parcel associated with your account');
    }

    const result = await this.workflowsService.create({ ...dto, createdBy: dto.createdBy ?? user.name });
    if (result === 'PARCEL_NOT_FOUND') {
      throw new BadRequestException(`Parcel not found: ${dto.parcelId}`);
    }
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'WORKFLOW_CREATED',
      entityType: 'WORKFLOW',
      entityId: result.id,
      parcelId: result.parcelId,
      metadata: { workflowType: result.workflowType },
    });
    return result;
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async findAll(
    @CurrentUser() user: User,
    @Query('department') department?: string,
    @Query('stepStatus') stepStatus?: string,
  ) {
    // An officer only ever gets their own department's queue, regardless of
    // what a client sends - only ADMIN may query across departments (or
    // narrow to a specific one via the query param).
    const scopedDepartment = user.role === 'ADMIN' ? department : ROLE_DEPARTMENT[user.role];
    return this.workflowsService.findAll({ department: scopedDepartment, stepStatus });
  }

  // Registered before ':id' so 'mine' is never swallowed as an id param -
  // same precedent as ParcelsController's GET /parcels/mine. Requests
  // aggregated across every parcel the signed-in citizen actually owns
  // (docs/FRONTEND_UPGRADE_SPEC.md §4's "Requests" page).
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE)
  async findMine(@CurrentUser() user: User) {
    return this.workflowsService.findMineForCitizen(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const workflow = await this.workflowsService.findOne(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow not found: ${id}`);
    }
    return workflow;
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async updateStatus(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkflowStatusDto) {
    const workflow = await this.workflowsService.updateStatus(id, dto);
    if (!workflow) {
      throw new NotFoundException(`Workflow not found: ${id}`);
    }
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'WORKFLOW_STATUS_CHANGED',
      entityType: 'WORKFLOW',
      entityId: id,
      parcelId: workflow.parcelId,
      metadata: { status: dto.status, remarks: dto.remarks ?? null },
    });
    return workflow;
  }

  @Patch(':workflowId/steps/:stepId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async reviewStep(
    @CurrentUser() user: User,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: ReviewWorkflowStepDto,
  ) {
    const result = await this.workflowsService.reviewStep(workflowId, stepId, dto, user.role);
    if (result === 'WORKFLOW_NOT_FOUND') {
      throw new NotFoundException(`Workflow not found: ${workflowId}`);
    }
    if (result === 'STEP_NOT_FOUND') {
      throw new NotFoundException(`Workflow step not found: ${stepId}`);
    }
    if (result === 'FORBIDDEN_WRONG_DEPARTMENT') {
      throw new ForbiddenException('This workflow step is not assigned to your role');
    }
    if (result === 'STEP_ALREADY_DECIDED') {
      throw new BadRequestException('This workflow step has already been decided');
    }
    const decidedStep = result.steps.find((s) => s.id === stepId)!;
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: decidedStep.action === 'APPROVE' ? 'WORKFLOW_STEP_APPROVED' : 'WORKFLOW_STEP_REJECTED',
      entityType: 'WORKFLOW_STEP',
      entityId: stepId,
      parcelId: result.parcelId,
      metadata: { workflowId, department: decidedStep.department, remarks: decidedStep.remarks },
    });
    return result;
  }
}
