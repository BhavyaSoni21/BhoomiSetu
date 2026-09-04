import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// A citizen service request (Tech.md #23/#24 - "workflows" table), e.g.
// "request a copy of the RoR" or "correction request". `parcelId` is a
// plain string, not a relation, consistent with the department records
// pattern elsewhere. `createdBy` is a free-text name/contact rather than a
// user UUID - there's no auth system yet (Phase 10), so a service request
// form can't assume a logged-in citizen.
@Entity('workflows')
@Index(['parcelId'])
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'varchar', length: 40 })
  workflowType: string; // e.g. ROR_COPY_REQUEST | CORRECTION_REQUEST

  @Column({ type: 'varchar', length: 20, default: 'SUBMITTED' })
  currentStatus: string; // SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | COMPLETED

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @Column({ type: 'text', nullable: true })
  requestDetails: string | null;

  @Column({ type: 'text', nullable: true })
  lastRemarks: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
