import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Tech.md #26/#27's audit_logs table - the "AUDIT LOG" stage in Tech.md
// §25's simulated-workflow diagram, sitting between an officer's decision
// and citizen notification (docs/FEATURE_AUDIT.md §8 item 10). `parcelId` is
// a pragmatic addition beyond Tech.md's literal columns (same as
// `Parcel.clusterId` elsewhere in this schema) so GET /parcels/:id/audit can
// index straight to it instead of parsing every row's `metadata` JSON.
@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['parcelId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 30 })
  userRole: string;

  @Column({ type: 'varchar', length: 60 })
  action: string; // e.g. AUTH_LOGIN | WORKFLOW_STEP_APPROVED | WORKFLOW_STEP_REJECTED | WORKFLOW_STATUS_CHANGED | GOVERNANCE_ALERT_STATUS_CHANGED

  @Column({ type: 'varchar', length: 40 })
  entityType: string; // USER | WORKFLOW | WORKFLOW_STEP | GOVERNANCE_ALERT

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', nullable: true })
  parcelId: string | null;

  @Column({ type: 'text', nullable: true })
  metadata: string | null; // JSON-serialized, e.g. {"department":"LAND_RECORDS","remarks":"..."}

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
