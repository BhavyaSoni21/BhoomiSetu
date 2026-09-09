import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { downloadFromStorage } from '../common/supabase-storage';
import { Parcel } from '../parcels/parcel.entity';
import { CitizenParcel } from '../parcels/citizen-parcel.entity';
import { ParcelDocument } from '../parcels/parcel-document.entity';
import { User } from '../users/user.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStep } from './workflow-step.entity';
import { CreateWorkflowDto, ReviewWorkflowStepDto, UpdateWorkflowStatusDto, EscalateWorkflowStepDto } from './dto/workflow.dto';
import { RequestRoutingService } from './request-routing.service';
import { NotificationFeedService } from '../notification-feed/notification-feed.service';
import { textContainsApproxNumber, textContainsIdentifier, textContainsName } from '../document-verification/field-matcher';

// The simulated review pipeline a workflow gets (Tech.md #25): CITIZEN
// REQUEST -> WORKFLOW CREATED -> LAND RECORD REVIEW -> REGISTRATION REVIEW
// -> PLANNING REVIEW -> OFFICER DECISION. Used as-is for every workflowType
// except DISPUTE_FILING, which gets its own single-step DISPUTE review
// instead - added after the SIH problem statement's required workflow list
// ("land records, registration, dispute, planning, and fiscal") turned out
// to have no dispute path anywhere in this codebase (see
// docs/FEATURE_AUDIT.md). Any other/future workflowType falls back to
// DEFAULT_PIPELINE, preserving the original "one pipeline for everything"
// behavior for ROR_COPY_REQUEST/CORRECTION_REQUEST. Audit logging and
// citizen notification (the diagram's last two stages) are Phase 10/out of
// scope here - no AuditModule to log into yet.
const DEFAULT_PIPELINE: Array<{ department: string; assignedRole: string }> = [
  { department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER' },
  { department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER' },
  { department: 'PLANNING', assignedRole: 'PLANNING_OFFICER' },
];

// LAND_CLAIM_REQUEST (a claim on a parcel the citizen isn't yet linked to)
// and DOCUMENT_VERIFICATION_REQUEST (a check against papers already on file
// for a parcel they ARE linked to) both route to Land Records and both get
// the automatic OCR pre-check (see buildVerificationPrecheck) - reframing
// the old standalone instant-verify feature as the mechanism behind these
// two real, officer-reviewed workflows instead.
const PIPELINES_BY_TYPE: Record<string, Array<{ department: string; assignedRole: string }>> = {
  DISPUTE_FILING: [{ department: 'DISPUTE', assignedRole: 'DISPUTE_OFFICER' }],
  LAND_CLAIM_REQUEST: [{ department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER' }],
  DOCUMENT_VERIFICATION_REQUEST: [{ department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER' }],
};

const VERIFICATION_WORKFLOW_TYPES = new Set(['LAND_CLAIM_REQUEST', 'DOCUMENT_VERIFICATION_REQUEST']);

function pipelineFor(workflowType: string): Array<{ department: string; assignedRole: string }> {
  return PIPELINES_BY_TYPE[workflowType] ?? DEFAULT_PIPELINE;
}

export type WorkflowWithSteps = Workflow & { steps: WorkflowStep[] };

// Extra fields the controller resolves server-side from the signed-in
// citizen (never client-entered) - citizenId replaces the old
// citizen_parcels-join lookup notifyCitizenOfStepDecision used to need, and
// is the only way to know "which citizen" for a LAND_CLAIM_REQUEST before
// any link exists; applicantContact/applicantAddress are the "simplified
// Raise Request" snapshot the officer sees instead of a separate lookup.
// A citizen-submitted file to attach to this request (docs/FRONTEND_UPGRADE_SPEC.md
// follow-up, "upload-first Land Claim") - see workflow.entity.ts's evidence
// columns for why this is kept distinct from a parcel's ParcelDocument.
export interface WorkflowEvidenceInput {
  fileName: string;
  filePath: string;
  mimeType: string;
  extractedText: string | null;
}

export type CreateWorkflowInput = CreateWorkflowDto & {
  citizenId?: string;
  applicantContact?: string | null;
  applicantAddress?: string | null;
  evidence?: WorkflowEvidenceInput | null;
};

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(CitizenParcel) private readonly citizenParcelRepository: Repository<CitizenParcel>,
    @InjectRepository(ParcelDocument) private readonly parcelDocumentRepository: Repository<ParcelDocument>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Workflow) private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowStep) private readonly stepRepository: Repository<WorkflowStep>,
    private readonly routingService: RequestRoutingService,
    private readonly notificationFeedService: NotificationFeedService,
  ) {}

  // Land Claim conflict check (docs/FRONTEND_UPGRADE_SPEC.md follow-up): a
  // parcel already linked to ANY citizen - including, in principle, the
  // same one filing again - can't be claimed a second time; the citizen is
  // pointed at the existing Dispute Filing flow instead of a new conflict-
  // tracking subsystem. Re-checked at review time too (reviewStep), since a
  // conflict could appear between filing and decision.
  async hasConflictingClaim(parcelId: string): Promise<boolean> {
    const existing = await this.citizenParcelRepository.findOne({ where: { parcel: { id: parcelId } } });
    return existing !== null;
  }

  // Lets the controller tell "parcel doesn't exist" (400, existing contract -
  // see create()'s own PARCEL_NOT_FOUND path) apart from "parcel exists but
  // isn't yours" (403) *before* running the association check below - same
  // existence-then-association ordering as ParcelsController's
  // GET /:id/ownership-history.
  async parcelExists(parcelId: string): Promise<boolean> {
    const count = await this.parcelRepository.count({ where: { id: parcelId } });
    return count > 0;
  }

  // Raise Request restricted to a citizen's own parcels (docs/FRONTEND_UPGRADE_SPEC.md
  // §4) - the authorization check WorkflowsController.create() runs before
  // ever calling create() below. Same query shape as ParcelsService's own
  // isCitizenAssociatedWithParcel, duplicated per this module's own-repository
  // convention rather than a cross-module call (see workflows.module.ts).
  async isCitizenAssociatedWithParcel(citizenId: string, parcelId: string): Promise<boolean> {
    const link = await this.citizenParcelRepository.findOne({
      where: { citizen: { id: citizenId }, parcel: { id: parcelId } },
    });
    return link !== null;
  }

  // Requests aggregated across every parcel a citizen actually owns
  // (docs/FRONTEND_UPGRADE_SPEC.md §4's "Requests" page) - today's
  // findByParcel is scoped to one parcel at a time (Parcel 360's per-parcel
  // panel); this is the cross-parcel rollup that panel doesn't attempt.
  async findMineForCitizen(citizenId: string): Promise<WorkflowWithSteps[]> {
    const links = await this.citizenParcelRepository.find({ where: { citizen: { id: citizenId } }, relations: ['parcel'] });
    const parcelIds = links.map((link) => link.parcel.id);
    if (parcelIds.length === 0) return [];

    const workflows = await this.workflowRepository.find({
      where: { parcelId: In(parcelIds) },
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      workflows.map(async (workflow) => {
        const steps = await this.stepRepository
          .createQueryBuilder('step')
          .where('step.workflow_id = :id', { id: workflow.id })
          .orderBy('step.stepOrder', 'ASC')
          .getMany();
        return { ...workflow, steps };
      }),
    );
  }

  async create(dto: CreateWorkflowInput): Promise<WorkflowWithSteps | 'PARCEL_NOT_FOUND'> {
    const parcel = await this.parcelRepository.findOneBy({ id: dto.parcelId });
    if (!parcel) return 'PARCEL_NOT_FOUND';

    // AI-based routing (RequestRoutingService) is the primary mechanism when
    // it returns a valid result; the deterministic pipelineFor() is the
    // guaranteed fallback (unconfigured/failed/empty AI call, or a request
    // with no requestDetails to analyse) - see request-routing.service.ts.
    const routing = await this.routingService.suggestPipeline(dto.workflowType, dto.requestDetails);
    const pipeline = routing.pipeline.length > 0 ? routing.pipeline : pipelineFor(dto.workflowType);

    // Evidence's own OCR text is preferred (the citizen just submitted it
    // specifically for this request); an existing ParcelDocument is the
    // fallback (Verify Documents against papers already on file - no new
    // upload involved). Whichever it is, the pre-check itself is unchanged.
    let verificationPrecheck: string | null = null;
    if (VERIFICATION_WORKFLOW_TYPES.has(dto.workflowType)) {
      const existingDocument = dto.evidence
        ? null
        : await this.parcelDocumentRepository.findOne({ where: { parcelId: dto.parcelId } });
      const ocrText = dto.evidence?.extractedText ?? existingDocument?.extractedText ?? null;
      verificationPrecheck = this.buildVerificationPrecheck(parcel, dto.createdBy ?? 'Applicant', ocrText);
    }

    const workflow = await this.workflowRepository.save({
      parcelId: dto.parcelId,
      workflowType: dto.workflowType,
      createdBy: dto.createdBy ?? null,
      requestDetails: dto.requestDetails ?? null,
      currentStatus: 'SUBMITTED',
      routingNotes: routing.pipeline.length > 0 ? routing.routingNotes : null,
      citizenId: dto.citizenId ?? null,
      applicantContact: dto.applicantContact ?? null,
      applicantAddress: dto.applicantAddress ?? null,
      verificationPrecheck,
      evidenceFileName: dto.evidence?.fileName ?? null,
      evidenceFilePath: dto.evidence?.filePath ?? null,
      evidenceMimeType: dto.evidence?.mimeType ?? null,
      evidenceExtractedText: dto.evidence?.extractedText ?? null,
    });

    await this.stepRepository.save(
      pipeline.map((stage, index) => ({
        workflow,
        stepOrder: index + 1,
        department: stage.department,
        assignedRole: stage.assignedRole,
        status: 'PENDING',
      })),
    );

    await this.notifyAssignedOfficers(workflow, pipeline);

    // Re-fetch via the same joinless query the other methods use, so every
    // response has the same shape (steps without a redundant nested `workflow`).
    return (await this.findOne(workflow.id))!;
  }

  // New-request notification (docs/FRONTEND_UPGRADE_SPEC.md §11 item 5,
  // resolved: in-app only) - every officer holding one of the pipeline's
  // assigned roles gets their own notification row, not a shared broadcast.
  private async notifyAssignedOfficers(workflow: Workflow, pipeline: Array<{ department: string; assignedRole: string }>): Promise<void> {
    const roles = [...new Set(pipeline.map((stage) => stage.assignedRole))];
    if (roles.length === 0) return;

    const officers = await this.userRepository.find({ where: { role: In(roles) } });
    if (officers.length === 0) return;

    const departments = pipeline.map((stage) => stage.department).join(', ');
    await this.notificationFeedService.notifyUsers(
      officers.map((officer) => officer.id),
      {
        type: 'WORKFLOW_ASSIGNED',
        title: `New ${workflow.workflowType.replace(/_/g, ' ').toLowerCase()} request`,
        message: workflow.routingNotes
          ? `A new request needs your department's review (${departments}). ${workflow.routingNotes}`
          : `A new request needs your department's review (${departments}).`,
        parcelId: workflow.parcelId,
        workflowId: workflow.id,
      },
    );
  }

  // Automatic OCR pre-check (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
  // reuses the existing OCR/field-matcher code from the now-removed
  // standalone document-verification feature against the applicant's own
  // name, the parcel's area, and its ULPIN if it has one. Shown to the
  // officer as an aid; the officer's decision is what actually counts, not
  // this match. Takes the OCR'd text directly (the caller decides whether
  // it came from freshly-submitted evidence or an existing ParcelDocument -
  // see create()) rather than looking it up itself. Returns a JSON string
  // (Workflow.verificationPrecheck is a plain text column) - NO_DOCUMENT_ON_FILE
  // when there's no text at all (a Land Claim identified from OCR always has
  // evidence text by the time this runs, so this mainly covers a Verify
  // Documents request against a parcel with nothing on file) - not the same
  // as a MISMATCH.
  private buildVerificationPrecheck(parcel: Parcel, applicantName: string, extractedText: string | null): string {
    if (!extractedText) {
      return JSON.stringify({ verdict: 'NO_DOCUMENT_ON_FILE', checks: [] });
    }

    const checks: Array<{ field: string; expectedValue: string; status: 'MATCHED' | 'MISMATCH' }> = [
      {
        field: 'OWNER_NAME',
        expectedValue: applicantName,
        status: textContainsName(extractedText, applicantName) ? 'MATCHED' : 'MISMATCH',
      },
      {
        field: 'AREA',
        expectedValue: `${parcel.areaSqM} sqm`,
        status: textContainsApproxNumber(extractedText, Number(parcel.areaSqM)) ? 'MATCHED' : 'MISMATCH',
      },
    ];
    if (parcel.ulpin) {
      checks.push({
        field: 'ULPIN',
        expectedValue: parcel.ulpin,
        status: textContainsIdentifier(extractedText, parcel.ulpin) ? 'MATCHED' : 'MISMATCH',
      });
    }

    const matchedCount = checks.filter((c) => c.status === 'MATCHED').length;
    const verdict = matchedCount === checks.length ? 'MATCHED' : matchedCount === 0 ? 'MISMATCH' : 'PARTIAL_MATCH';
    return JSON.stringify({ verdict, checks });
  }

  // The real, visible payoff of an officer's approval (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up) - not just a status label on the workflow itself. When the
  // approved workflow carried freshly-submitted evidence (an upload-first
  // Land Claim, or a Verify Documents request against a parcel with nothing
  // on file), that evidence IS promoted into becoming the parcel's official
  // ParcelDocument - overwriting whatever was there, since this is a fresh
  // submission specifically for this approval. Otherwise keeps the original
  // behavior: flip an existing document to REGISTERED, or create a bare row
  // with no image on disk if the parcel had nothing at all (getDocumentFile
  // reports that honestly rather than erroring on a missing file).
  private async markParcelDocumentRegistered(parcelId: string, freshEvidence: WorkflowEvidenceInput | null): Promise<void> {
    const document = await this.parcelDocumentRepository.findOne({ where: { parcelId } });

    if (freshEvidence) {
      await this.parcelDocumentRepository.save({
        ...(document ?? { parcelId, documentType: 'ROR_COPY' }),
        fileName: freshEvidence.fileName,
        filePath: freshEvidence.filePath,
        mimeType: freshEvidence.mimeType,
        extractedText: freshEvidence.extractedText,
        registrationStatus: 'REGISTERED',
      });
      return;
    }

    if (document) {
      if (document.registrationStatus !== 'REGISTERED') {
        document.registrationStatus = 'REGISTERED';
        await this.parcelDocumentRepository.save(document);
      }
      return;
    }
    await this.parcelDocumentRepository.save({
      parcelId,
      documentType: 'ROR_COPY',
      fileName: '',
      filePath: '',
      mimeType: 'image/png',
      extractedText: null,
      registrationStatus: 'REGISTERED',
    });
  }

  // Serves a workflow's submitted evidence file back (WorkflowsController's
  // staff-only GET :id/evidence) - null when the workflow doesn't exist,
  // carries no evidence, or the file is missing on disk.
  async getEvidenceFile(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const workflow = await this.workflowRepository.findOneBy({ id });
    if (!workflow || !workflow.evidenceFilePath) return null;
    try {
      const buffer = await downloadFromStorage(workflow.evidenceFilePath);
      return { buffer, mimeType: workflow.evidenceMimeType ?? 'image/png' };
    } catch {
      return null;
    }
  }

  async findOne(id: string): Promise<WorkflowWithSteps | null> {
    const workflow = await this.workflowRepository.findOneBy({ id });
    if (!workflow) return null;

    const steps = await this.stepRepository
      .createQueryBuilder('step')
      .where('step.workflow_id = :id', { id })
      .orderBy('step.stepOrder', 'ASC')
      .getMany();

    return { ...workflow, steps };
  }

  // Officer dashboard listing (Phase 7): every workflow, optionally narrowed
  // to ones with a step matching a given department and/or step status - i.e.
  // "workflows where my department's review is still pending". Fetches all
  // workflows (this mock never has more than a few hundred) rather than a
  // JOIN, matching this codebase's existing preference for plain JS filtering
  // over query-builder joins for read models (see e.g. change-detection's
  // point-in-polygon affected-parcel computation).
  async findAll(filters: { department?: string; stepStatus?: string }): Promise<WorkflowWithSteps[]> {
    const workflows = await this.workflowRepository.find({ order: { createdAt: 'DESC' } });

    const withSteps = await Promise.all(
      workflows.map(async (workflow) => {
        const steps = await this.stepRepository
          .createQueryBuilder('step')
          .where('step.workflow_id = :id', { id: workflow.id })
          .orderBy('step.stepOrder', 'ASC')
          .getMany();
        return { ...workflow, steps };
      }),
    );

    if (!filters.department && !filters.stepStatus) return withSteps;

    return withSteps.filter((workflow) =>
      workflow.steps.some(
        (step) =>
          (!filters.department || step.department === filters.department) &&
          (!filters.stepStatus || step.status === filters.stepStatus),
      ),
    );
  }

  async findByParcel(parcelId: string): Promise<WorkflowWithSteps[]> {
    const workflows = await this.workflowRepository.find({
      where: { parcelId },
      order: { createdAt: 'DESC' },
    });

    const withSteps = await Promise.all(
      workflows.map(async (workflow) => {
        const steps = await this.stepRepository
          .createQueryBuilder('step')
          .where('step.workflow_id = :id', { id: workflow.id })
          .orderBy('step.stepOrder', 'ASC')
          .getMany();
        return { ...workflow, steps };
      }),
    );

    return withSteps;
  }

  async updateStatus(id: string, dto: UpdateWorkflowStatusDto): Promise<WorkflowWithSteps | null> {
    const workflow = await this.workflowRepository.findOneBy({ id });
    if (!workflow) return null;

    workflow.currentStatus = dto.status;
    if (dto.remarks !== undefined) workflow.lastRemarks = dto.remarks;
    await this.workflowRepository.save(workflow);

    return this.findOne(id);
  }

  // The actual officer review action (Phase 7): approve/reject ONE
  // workflow_steps row, then recompute the workflow's overall current_status
  // from every step's outcome - any REJECTED step rejects the whole workflow,
  // all APPROVED steps approves it, otherwise it's IN_PROGRESS. A step can
  // only be decided once (PENDING -> APPROVED/REJECTED), matching real
  // governance semantics rather than letting an officer flip a past decision.
  async reviewStep(
    workflowId: string,
    stepId: string,
    dto: ReviewWorkflowStepDto,
    actingUserRole: string,
  ): Promise<
    WorkflowWithSteps | 'WORKFLOW_NOT_FOUND' | 'STEP_NOT_FOUND' | 'STEP_ALREADY_DECIDED' | 'FORBIDDEN_WRONG_DEPARTMENT' | 'CLAIM_CONFLICT'
  > {
    const workflow = await this.workflowRepository.findOneBy({ id: workflowId });
    if (!workflow) return 'WORKFLOW_NOT_FOUND';

    const step = await this.stepRepository
      .createQueryBuilder('step')
      .where('step.id = :stepId', { stepId })
      .andWhere('step.workflow_id = :workflowId', { workflowId })
      .getOne();
    if (!step) return 'STEP_NOT_FOUND';
    // ADMIN can decide any step regardless of department; every officer role
    // may only decide the step assigned to their own role - a
    // LAND_RECORD_OFFICER approving a REGISTRATION step, say, is exactly the
    // gap RBAC (docs/FEATURE_AUDIT.md §8 item 5) closes.
    if (actingUserRole !== 'ADMIN' && step.assignedRole !== actingUserRole) return 'FORBIDDEN_WRONG_DEPARTMENT';
    if (step.status !== 'PENDING') return 'STEP_ALREADY_DECIDED';

    // Re-checked here (also checked at filing time, WorkflowsController.create) -
    // a conflict could appear between filing and this decision. Checked
    // before any mutation below: LAND_CLAIM_REQUEST's pipeline is always
    // exactly one step (PIPELINES_BY_TYPE), so "approve this step" and
    // "approve the whole claim" are the same event.
    if (dto.action === 'APPROVE' && workflow.workflowType === 'LAND_CLAIM_REQUEST') {
      const conflict = await this.hasConflictingClaim(workflow.parcelId);
      if (conflict) return 'CLAIM_CONFLICT';
    }

    step.status = dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    step.action = dto.action;
    step.remarks = dto.remarks ?? null;
    step.completedAt = new Date();
    await this.stepRepository.save(step);

    const allSteps = await this.stepRepository
      .createQueryBuilder('step')
      .where('step.workflow_id = :workflowId', { workflowId })
      .getMany();

    if (allSteps.some((s) => s.status === 'REJECTED')) {
      workflow.currentStatus = 'REJECTED';
    } else if (allSteps.every((s) => s.status === 'APPROVED')) {
      workflow.currentStatus = 'APPROVED';
    } else {
      workflow.currentStatus = 'IN_PROGRESS';
    }
    await this.workflowRepository.save(workflow);

    // The real, visible payoff of an approval (docs/FRONTEND_UPGRADE_SPEC.md
    // follow-up) - only reachable once the whole workflow is APPROVED, which
    // for these two single-step pipelines means exactly this step.
    if (dto.action === 'APPROVE' && workflow.currentStatus === 'APPROVED') {
      if (workflow.workflowType === 'LAND_CLAIM_REQUEST' && workflow.citizenId) {
        await this.citizenParcelRepository.save({
          citizen: { id: workflow.citizenId } as User,
          parcel: { id: workflow.parcelId } as Parcel,
        });
      }
      if (VERIFICATION_WORKFLOW_TYPES.has(workflow.workflowType)) {
        const freshEvidence: WorkflowEvidenceInput | null = workflow.evidenceFilePath
          ? {
              fileName: workflow.evidenceFileName!,
              filePath: workflow.evidenceFilePath,
              mimeType: workflow.evidenceMimeType!,
              extractedText: workflow.evidenceExtractedText,
            }
          : null;
        await this.markParcelDocumentRegistered(workflow.parcelId, freshEvidence);
      }
    }

    await this.notifyCitizenOfStepDecision(workflow, step);

    return (await this.findOne(workflowId))!;
  }

  // Admin oversight "alert the officers" action (docs/ADMIN_PANEL_ISSUES.md
  // Coming Soon #2 follow-up, per the user's explicit "the admin dont have
  // to approve the workflow... he can alert the officers for checking on
  // some case at the earliest"): an Admin is not expected to decide a
  // pending step by default - this notifies whoever holds the step's
  // assignedRole to prioritize it, without touching step.status/action at
  // all. Deliberately reuses notifyUsers rather than a new module, same as
  // notifyAssignedOfficers/notifyCitizenOfStepDecision below.
  async escalateStep(
    workflowId: string,
    stepId: string,
    dto: EscalateWorkflowStepDto,
  ): Promise<WorkflowWithSteps | 'WORKFLOW_NOT_FOUND' | 'STEP_NOT_FOUND' | 'STEP_ALREADY_DECIDED'> {
    const workflow = await this.workflowRepository.findOneBy({ id: workflowId });
    if (!workflow) return 'WORKFLOW_NOT_FOUND';

    const step = await this.stepRepository
      .createQueryBuilder('step')
      .where('step.id = :stepId', { stepId })
      .andWhere('step.workflow_id = :workflowId', { workflowId })
      .getOne();
    if (!step) return 'STEP_NOT_FOUND';
    if (step.status !== 'PENDING') return 'STEP_ALREADY_DECIDED';

    const officers = await this.userRepository.find({ where: { role: step.assignedRole } });
    await this.notificationFeedService.notifyUsers(
      officers.map((officer) => officer.id),
      {
        type: 'ADMIN_ESCALATION',
        title: `Admin flagged this ${workflow.workflowType.replace(/_REQUEST$/, '').replace(/_/g, ' ').toLowerCase()} request for urgent review`,
        message: dto.message,
        parcelId: workflow.parcelId,
        workflowId: workflow.id,
      },
    );

    return (await this.findOne(workflowId))!;
  }

  // Step-decision notification, the "vice versa" direction of
  // notifyAssignedOfficers above. Resolved directly via workflow.citizenId
  // (set once at creation - see WorkflowsController.create) rather than the
  // old citizen_parcels-join lookup, which can't work for a LAND_CLAIM_REQUEST
  // at all (no link exists until this very decision creates one, above).
  private async notifyCitizenOfStepDecision(workflow: Workflow, step: WorkflowStep): Promise<void> {
    if (!workflow.citizenId) return;

    const verb = step.action === 'APPROVE' ? 'approved' : 'rejected';
    await this.notificationFeedService.notifyUsers([workflow.citizenId], {
      type: step.action === 'APPROVE' ? 'WORKFLOW_STEP_APPROVED' : 'WORKFLOW_STEP_REJECTED',
      title: `Your request was ${verb}`,
      message: step.remarks
        ? `${step.department.replace(/_/g, ' ')} ${verb} your request. ${step.remarks}`
        : `${step.department.replace(/_/g, ' ')} ${verb} your request.`,
      parcelId: workflow.parcelId,
      workflowId: workflow.id,
    });
  }
}
