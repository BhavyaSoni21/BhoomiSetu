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
  alertType: string; // RESTRICTION_ZONE_OVERLAP | UNAUTHORIZED_CHANGE_DETECTED | TAX_OVERDUE | DISPUTE_DETECTED | RESTRICTION_DETECTED

  @Column({ type: 'varchar', length: 20 })
  severity: string; // LOW | MEDIUM | HIGH | CRITICAL

  @Column({ type: 'varchar', length: 40 })
  source: string; // RESTRICTION_MONITOR | CHANGE_DETECTION | TAX_MONITOR | HISTORICAL_IMAGERY

  // Four verification stages (docs/ADMIN_PANEL_ISSUES.md Officer #4, added
  // 2026-09-10): OPEN (detected) -> ACKNOWLEDGED -> FIELD_VERIFIED -> RESOLVED,
  // with DISMISSED reachable from any of the first three as an early-exit for
  // a false alarm. Enforced as a linear progression by
  // GovernanceAlertsService.updateStatus's VALID_TRANSITIONS map - a flat
  // status column advancing through values, same modeling choice
  // Workflow.currentStatus already uses (SUBMITTED -> UNDER_REVIEW ->
  // APPROVED/REJECTED), not a child-steps table like WorkflowStep (that's for
  // *parallel per-department* steps, a different concept that doesn't fit a
  // single-department alert).
  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status: string; // OPEN | ACKNOWLEDGED | FIELD_VERIFIED | RESOLVED | DISMISSED

  @Column({ type: 'text' })
  explanation: string;

  // The officer's own reason for reviewing/dismissing this alert - set by
  // PATCH /governance-alerts/:id/status, surfaced to the relevant
  // department's officer(s) via a notification (see
  // GovernanceAlertsService.updateStatus / alertDepartmentFor()).
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
