import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { Workflow } from './workflow.entity';
import { WorkflowStep } from './workflow-step.entity';
import { CreateWorkflowDto, UpdateWorkflowStatusDto } from './dto/workflow.dto';

// The simulated review pipeline every workflow gets (Tech.md #25):
// CITIZEN REQUEST -> WORKFLOW CREATED -> LAND RECORD REVIEW -> REGISTRATION
// REVIEW -> PLANNING REVIEW -> OFFICER DECISION. Fixed regardless of
// workflowType - the spec doesn't ask for type-specific pipelines, and this
// matches the given diagram literally. Audit logging and citizen
// notification (the diagram's last two stages) are Phase 10/out of scope
// here - no AuditModule to log into yet.
const PIPELINE: Array<{ department: string; assignedRole: string }> = [
  { department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER' },
  { department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER' },
  { department: 'PLANNING', assignedRole: 'PLANNING_OFFICER' },
];

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
      PIPELINE.map((stage, index) => ({
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
}
