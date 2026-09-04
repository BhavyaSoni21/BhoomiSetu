import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Workflow } from './workflow.entity';

// Tech.md #24/#25's "workflow_steps": the simulated review pipeline a
// workflow moves through (LAND_RECORDS -> REGISTRATION -> PLANNING ->
// officer decision). Auto-created (all PENDING) when a workflow is
// submitted; Phase 7's Officer Portal is what actually advances these.
@Entity('workflow_steps')
@Index(['workflow'])
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({ type: 'int' })
  stepOrder: number;

  @Column({ type: 'varchar', length: 30 })
  department: string; // LAND_RECORDS | REGISTRATION | PLANNING

  @Column({ type: 'varchar', length: 40 })
  assignedRole: string; // LAND_RECORD_OFFICER | REGISTRATION_OFFICER | PLANNING_OFFICER

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string; // PENDING | IN_PROGRESS | APPROVED | REJECTED

  @Column({ type: 'varchar', length: 40, nullable: true })
  action: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;
}
