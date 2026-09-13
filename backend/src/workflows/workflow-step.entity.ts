import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Workflow } from './workflow.entity';
import { isSqliteConfigured } from '../database.config';

// Tech.md #24/#25's "workflow_steps": the simulated review pipeline a
// workflow moves through (LAND_RECORDS -> REGISTRATION -> PLANNING ->
// officer decision). Auto-created (all PENDING) when a workflow is
// submitted; Phase 7's Officer Portal is what actually advances these.
@Entity('workflow_steps')
@Index(['workflow_id'])
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({ name: 'department', type: 'varchar', length: 30 })
  department: string; // LAND_RECORDS | REGISTRATION | PLANNING | DISPUTE | TAX | RESTRICTION | ENCUMBRANCE

  @Column({ name: 'assigned_role', type: 'varchar', length: 40 })
  assignedRole: string; // LAND_RECORD_OFFICER | REGISTRATION_OFFICER | PLANNING_OFFICER | DISPUTE_OFFICER | TAX_OFFICER | RESTRICTION_OFFICER | ENCUMBRANCE_OFFICER

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'PENDING' })
  status: string; // PENDING | IN_PROGRESS | APPROVED | REJECTED

  @Column({ name: 'action', type: 'varchar', length: 40, nullable: true })
  action: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string | null;

  // No single literal column type is portable here: sqlite's driver only
  // recognizes 'datetime' and postgres's only recognizes 'timestamp' - each
  // caught live (once against Supabase, once by re-running the SQLite e2e
  // suite straight after - docs/FEATURE_AUDIT.md §8 item 14), so the type is
  // picked per-driver at class-definition time instead. Not a
  // @CreateDateColumn/@UpdateDateColumn - this is a business-domain value set
  // explicitly by WorkflowsService on approve/reject, not an automatic
  // row-lifecycle timestamp.
  @Column({ name: 'completed_at', type: isSqliteConfigured() ? 'datetime' : 'timestamp', nullable: true })
  completedAt: Date | null;
}
