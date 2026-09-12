import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Mock Dispute Department record - the fifth workflow type named in the SIH
// problem statement's required interoperable-workflow list ("land records,
// registration, dispute, planning, and fiscal systems"), previously absent
// from this codebase entirely (see docs/FEATURE_AUDIT.md). Mirrors the
// existing RestrictionRecord's shape: a per-parcel business record keyed by
// a plain parcelId string, independent of the other four mock departments.
@Entity('dispute_records')
@Index(['parcelId'])
export class DisputeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'boolean', default: false })
  hasActiveDispute: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true })
  disputeType: string | null; // OWNERSHIP | BOUNDARY | INHERITANCE | ENCROACHMENT

  @Column({ type: 'varchar', length: 20, nullable: true })
  caseStatus: string | null; // FILED | UNDER_REVIEW | RESOLVED | DISMISSED

  @Column({ type: 'date', nullable: true })
  filingDate: string | null;

  @Column({ type: 'date', nullable: true })
  resolutionDate: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  resolutionSummary: string | null;
}
