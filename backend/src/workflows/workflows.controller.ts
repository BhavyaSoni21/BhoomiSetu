import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, NotFoundException, BadRequestException, ForbiddenException, ConflictException, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { WorkflowsService, WorkflowEvidenceInput } from './workflows.service';
import { CreateWorkflowDto, ReviewWorkflowStepDto, UpdateWorkflowStatusDto, EscalateWorkflowStepDto } from './dto/workflow.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ALL_STAFF_ROLES, CITIZEN_ROLE, ROLE_DEPARTMENT } from '../auth/roles.constants';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';
import { extractText } from '../document-verification/ocr';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB, matching the old document-verification controller's own limit
// Runtime-written uploads (unlike cluster-snapshots/parcel-documents, which
// are only ever written by seed.ts) - path.resolve against process.cwd()
// rather than __dirname, matching how database.config.ts's SQLite path
// already resolves relative to wherever the process was started (the
// backend root, per npm run start:dev).
const EVIDENCE_DIR = path.resolve(process.cwd(), 'uploads/workflow-evidence');

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

  // Accepts multipart/form-data with an optional 'document' file (upload-first
  // Land Claim, Verify Documents when the parcel has no papers on file yet,
  // or Dispute Filing evidence) as well as a plain JSON body when no file is
  // attached - FileInterceptor/multer only activates for multipart requests,
  // so every existing JSON-only call site is unaffected.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CITIZEN_ROLE)
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  async create(@CurrentUser() user: User, @Body() dto: CreateWorkflowDto, @UploadedFile() file?: Express.Multer.File) {
    // Raise Request restricted to the citizen's own parcels
    // (docs/FRONTEND_UPGRADE_SPEC.md §4). Existence is checked before
    // association - same ordering as ParcelsController's
    // GET /:id/ownership-history - so a bogus parcel id still gets create()'s
    // existing 400 rather than being swallowed into a 403.
    const parcelExists = await this.workflowsService.parcelExists(dto.parcelId);
    if (!parcelExists) {
      throw new BadRequestException(`Parcel not found: ${dto.parcelId}`);
    }

    // LAND_CLAIM_REQUEST and DISPUTE_FILING are the two exceptions to the
    // association check below - claiming is precisely for a parcel the
    // citizen ISN'T yet linked to, and a dispute (e.g. "this parcel is
    // actually mine") is definitionally often about a parcel they don't
    // hold either. A Land Claim additionally conflicts if the parcel is
    // already linked to ANY citizen, pointed at Dispute Filing instead of a
    // new conflict-tracking subsystem (re-checked at review time too, see
    // WorkflowsService.reviewStep) - Dispute Filing itself has no such
    // conflict check, since disputing an existing link is the whole point.
    if (dto.workflowType === 'LAND_CLAIM_REQUEST') {
      const conflict = await this.workflowsService.hasConflictingClaim(dto.parcelId);
      if (conflict) {
        throw new ConflictException(
          'This parcel is already linked to another account. If you believe this is incorrect, file a dispute instead.',
        );
      }
    } else if (dto.workflowType !== 'DISPUTE_FILING') {
      const associated = await this.workflowsService.isCitizenAssociatedWithParcel(user.id, dto.parcelId);
      if (!associated) {
        throw new ForbiddenException('You can only raise a request for a parcel associated with your account');
      }
    }

    let evidence: WorkflowEvidenceInput | null = null;
    if (file) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('The attached document must be an image');
      }
      const { text } = await extractText(file.buffer);
      await fs.mkdir(EVIDENCE_DIR, { recursive: true });
      const fileName = `${randomUUID()}.${file.mimetype.split('/')[1] || 'png'}`;
      const filePath = path.join(EVIDENCE_DIR, fileName);
      await fs.writeFile(filePath, file.buffer);
      evidence = { fileName, filePath, mimeType: file.mimetype, extractedText: text };
    }

    // Simplified Raise Request (docs/FRONTEND_UPGRADE_SPEC.md follow-up):
    // applicant contact/address snapshotted from the citizen's own profile,
    // never client-entered - whichever contact method is actually verified,
    // matching how WorkflowReviewPanel needs a real way to reach them back.
    const applicantContact = user.mobileVerified ? user.mobileNumber : user.emailVerified ? user.email : null;
    const result = await this.workflowsService.create({
      ...dto,
      createdBy: dto.createdBy ?? user.name,
      citizenId: user.id,
      applicantContact,
      applicantAddress: user.address,
      evidence,
    });
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

  // Serves a citizen-submitted evidence file (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up) - staff-only, same as findOne above (a citizen never needs
  // this back from the server: the browser already holds the bytes locally
  // right after they upload it, via the File object/object URL, so only the
  // reviewing officer's page ever calls this).
  @Get(':id/evidence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ALL_STAFF_ROLES)
  async getEvidence(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.workflowsService.getEvidenceFile(id);
    if (!file) {
      throw new NotFoundException(`No evidence file found for workflow: ${id}`);
    }
    res.set('Content-Type', file.mimeType);
    res.send(file.buffer);
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
    if (result === 'CLAIM_CONFLICT') {
      throw new ConflictException(
        'This parcel was linked to another account before this claim could be approved. Direct the citizen to file a dispute instead.',
      );
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

  // Admin oversight "alert the officers" action - ADMIN-only (not
  // ALL_STAFF_ROLES like the review endpoints above): an officer reviewing
  // their own department's queue has no one else to escalate to, this is
  // specifically the Admin nudging the officer who actually owns the step.
  // Never changes the step's status/action - see WorkflowsService.escalateStep.
  @Post(':workflowId/steps/:stepId/escalate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async escalateStep(
    @CurrentUser() user: User,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: EscalateWorkflowStepDto,
  ) {
    const result = await this.workflowsService.escalateStep(workflowId, stepId, dto);
    if (result === 'WORKFLOW_NOT_FOUND') {
      throw new NotFoundException(`Workflow not found: ${workflowId}`);
    }
    if (result === 'STEP_NOT_FOUND') {
      throw new NotFoundException(`Workflow step not found: ${stepId}`);
    }
    if (result === 'STEP_ALREADY_DECIDED') {
      throw new BadRequestException('This workflow step has already been decided - nothing to escalate');
    }
    const escalatedStep = result.steps.find((s) => s.id === stepId)!;
    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'WORKFLOW_STEP_ESCALATED',
      entityType: 'WORKFLOW_STEP',
      entityId: stepId,
      parcelId: result.parcelId,
      metadata: { workflowId, department: escalatedStep.department, message: dto.message },
    });
    return result;
  }
}
