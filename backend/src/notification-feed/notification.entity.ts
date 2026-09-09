import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// In-app notification feed (docs/FRONTEND_UPGRADE_SPEC.md §11 item 5,
// resolved: in-app only, not push/SMS/email) - a real per-user row, not a
// broadcast, so "read" state never needs a separate join table. `userId` is
// a plain string like AuditLog.userId (no FK) - this table is written by
// several independent modules (Workflows, Governance) that shouldn't need
// to depend on UsersModule just to reference a user id. Named `notification-
// feed` (not `notifications`) to stay distinct from the existing
// backend/src/notifications/ module, which is OTP SMS/email delivery infra
// only and has nothing to do with this in-app feed.
@Entity('notifications')
@Index(['userId'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  type: string; // WORKFLOW_ASSIGNED | WORKFLOW_STEP_APPROVED | WORKFLOW_STEP_REJECTED | GOVERNANCE_ALERT_REVIEWED | GOVERNANCE_ALERT_DISMISSED

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', nullable: true })
  parcelId: string | null;

  @Column({ type: 'varchar', nullable: true })
  workflowId: string | null;

  @Column({ type: 'varchar', nullable: true })
  alertId: string | null;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
