import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStep } from './workflow-step.entity';
import { CreateWorkflowDto, ReviewWorkflowStepDto, UpdateWorkflowStatusDto } from './dto/workflow.dto';

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

const PIPELINES_BY_TYPE: Record<string, Array<{ department: string; assignedRole: string }>> = {
  DISPUTE_FILING: [{ department: 'DISPUTE', assignedRole: 'DISPUTE_OFFICER' }],
};

function pipelineFor(workflowType: string): Array<{ department: string; assignedRole: string }> {
  return PIPELINES_BY_TYPE[workflowType] ?? DEFAULT_PIPELINE;
}

export type WorkflowWithSteps = Workflow & { steps: WorkflowStep[] };

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(Workflow) private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowStep) private readonly stepRepository: Repository<WorkflowStep>,
  ) {}

  async create(dto: CreateWorkflowDto): Promise<WorkflowWithSteps | 'PARCEL_NOT_FOUND'> {
    const parcel = await this.parcelRepository.findOneBy({ id: dto.parcelId });
    if (!parcel) return 'PARCEL_NOT_FOUND';

    const workflow = await this.workflowRepository.save({
      parcelId: dto.parcelId,
      workflowType: dto.workflowType,
      createdBy: dto.createdBy ?? null,
      requestDetails: dto.requestDetails ?? null,
      currentStatus: 'SUBMITTED',
    });

    await this.stepRepository.save(
      pipelineFor(dto.workflowType).map((stage, index) => ({
        workflow,
        stepOrder: index + 1,
        department: stage.department,
        assignedRole: stage.assignedRole,
        status: 'PENDING',
      })),
    );

    // Re-fetch via the same joinless query the other methods use, so every
    // response has the same shape (steps without a redundant nested `workflow`).
    return (await this.findOne(workflow.id))!;
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
  ): Promise<WorkflowWithSteps | 'WORKFLOW_NOT_FOUND' | 'STEP_NOT_FOUND' | 'STEP_ALREADY_DECIDED' | 'FORBIDDEN_WRONG_DEPARTMENT'> {
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

    return (await this.findOne(workflowId))!;
  }
}
