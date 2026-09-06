import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Tech.md #34 governance_alerts: the officer-facing output of the AI /
// change-detection pipeline built in Phase 8/9. The Officer Portal (Phase 7)
// needs the data model, API, and review panel to exist now, so this is
// seeded from spatial/tax data seed.ts already computed (restriction-zone
// overlap, the simulated change-detection event, overdue tax) rather than
// hand-picked - standing in for the real OpenCV + spatial-intersection +
// LLM-explanation pipeline until that phase builds it.
@Entity('governance_alerts')
@Index(['parcelId'])
export class GovernanceAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  parcelId: string;

  @Column({ type: 'varchar', length: 40 })
  alertType: string; // RESTRICTION_ZONE_OVERLAP | UNAUTHORIZED_CHANGE_DETECTED | TAX_OVERDUE

  @Column({ type: 'varchar', length: 20 })
  severity: string; // LOW | MEDIUM | HIGH | CRITICAL

  @Column({ type: 'varchar', length: 40 })
  source: string; // RESTRICTION_MONITOR | CHANGE_DETECTION | TAX_MONITOR

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string; // OPEN | REVIEWED | DISMISSED

  @Column({ type: 'text' })
  explanation: string;

  @CreateDateColumn()
  createdAt: Date;
}
