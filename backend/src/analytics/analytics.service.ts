import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { RegistrationRecord } from '../departments/registration-record.entity';
import { PlanningRecord } from '../departments/planning-record.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { Workflow } from '../workflows/workflow.entity';
import { WorkflowStep } from '../workflows/workflow-step.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { User } from '../users/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { ALL_STAFF_ROLES, OFFICER_ROLES, ROLE_DEPARTMENT } from '../auth/roles.constants';
import { CLOSED_ALERT_STATUSES } from '../governance/governance-alerts.service';

export interface Distribution {
  key: string;
  count: number;
}

export interface AnalyticsSummary {
  totals: {
    parcels: number;
    workflows: number;
    openAlerts: number;
    activeDisputes: number;
    totalUsers: number;
    recentLogins24h: number;
  };
  taxStatusDistribution: Distribution[];
  registrationStatusDistribution: Distribution[];
  landUseDistribution: Distribution[];
  disputeCaseStatusDistribution: Distribution[];
  workflowStatusDistribution: Distribution[];
  workflowTypeDistribution: Distribution[];
  alertSeverityDistribution: Distribution[];
  alertStatusDistribution: Distribution[];
}

export interface OfficerMonitoringEntry {
  userId: string;
  name: string;
  role: string;
  department: string;
  // WorkflowStep has no per-user assignee column, only assignedRole (a role,
  // shared by every officer holding it, per WorkflowsService.reviewStep's own
  // RBAC check) - this is a real count, just role-level rather than
  // personal. Two officers sharing a role will show the same number here.
  pendingInRoleQueue: number;
  approvedCount: number;
  rejectedCount: number;
  avgDecisionHours: number | null;
  lastActivityAt: string | null;
}

// Closes the "analytics-driven governance insights" gap named in the SIH
// problem statement's required-solution text (docs/FEATURE_AUDIT.md §1) -
// platform-wide aggregates across every department/workflow/alert table,
// distinct from the per-alert AI explanation Phase 8 already built. Real
// SQL-level GROUP BY aggregation (works the same under SQLite or a future
// PostGIS/Postgres migration), not a full table scan aggregated in JS.
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(TaxRecord) private readonly taxRepository: Repository<TaxRecord>,
    @InjectRepository(RegistrationRecord) private readonly registrationRepository: Repository<RegistrationRecord>,
    @InjectRepository(PlanningRecord) private readonly planningRepository: Repository<PlanningRecord>,
    @InjectRepository(DisputeRecord) private readonly disputeRepository: Repository<DisputeRecord>,
    @InjectRepository(Workflow) private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowStep) private readonly workflowStepRepository: Repository<WorkflowStep>,
    @InjectRepository(GovernanceAlert) private readonly alertRepository: Repository<GovernanceAlert>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  private async groupCount<T extends object>(
    repository: Repository<T>,
    column: string,
  ): Promise<Distribution[]> {
    const rows = await repository
      .createQueryBuilder('t')
      .select(`t.${column}`, 'key')
      .addSelect('COUNT(*)', 'count')
      .where(`t.${column} IS NOT NULL`)
      .groupBy(`t.${column}`)
      .getRawMany<{ key: string; count: string }>();

    return rows.map((row) => ({ key: row.key, count: Number(row.count) }));
  }

  async getSummary(): Promise<AnalyticsSummary> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      parcelCount,
      workflowCount,
      openAlertCount,
      activeDisputeCount,
      totalUsers,
      recentLogins24h,
      taxStatusDistribution,
      registrationStatusDistribution,
      landUseDistribution,
      disputeCaseStatusDistribution,
      workflowStatusDistribution,
      workflowTypeDistribution,
      alertSeverityDistribution,
      alertStatusDistribution,
    ] = await Promise.all([
      this.parcelRepository.count(),
      this.workflowRepository.count(),
      // "Open Alerts" means "still needs attention" - since the 4-stage
      // rework (docs/ADMIN_PANEL_ISSUES.md Officer #4) that's 3 real statuses
      // (OPEN/ACKNOWLEDGED/FIELD_VERIFIED), not just the literal OPEN one.
      this.alertRepository.count({ where: { status: Not(In(CLOSED_ALERT_STATUSES)) } }),
      this.disputeRepository.count({ where: { hasActiveDispute: true } }),
      // Staff only - matches UsersService.findAll()'s scoping, so this
      // "Total Users" metric keeps meaning "how many officer/admin accounts
      // exist" now that citizen sign-in accounts also live in this table.
      this.userRepository.count({ where: { role: In([...ALL_STAFF_ROLES]) } }),
      this.auditLogRepository.count({ where: { action: 'AUTH_LOGIN', createdAt: MoreThan(oneDayAgo) } }),
      this.groupCount(this.taxRepository, 'taxStatus'),
      this.groupCount(this.registrationRepository, 'registrationStatus'),
      this.groupCount(this.planningRepository, 'landUse'),
      this.groupCount(this.disputeRepository, 'caseStatus'),
      this.groupCount(this.workflowRepository, 'currentStatus'),
      this.groupCount(this.workflowRepository, 'workflowType'),
      this.groupCount(this.alertRepository, 'severity'),
      this.groupCount(this.alertRepository, 'status'),
    ]);

    return {
      totals: {
        parcels: parcelCount,
        workflows: workflowCount,
        openAlerts: openAlertCount,
        activeDisputes: activeDisputeCount,
        totalUsers,
        recentLogins24h,
      },
      taxStatusDistribution,
      registrationStatusDistribution,
      landUseDistribution,
      disputeCaseStatusDistribution,
      workflowStatusDistribution,
      workflowTypeDistribution,
      alertSeverityDistribution,
      alertStatusDistribution,
    };
  }

  // "Officer monitoring - how officers handle citizen issues"
  // (docs/ADMIN_PANEL_ISSUES.md Admin #4). Built entirely from data that
  // already exists, no new logging: pending workload comes from a real SQL
  // GROUP BY over WorkflowStep (same technique as groupCount above); who
  // personally approved/rejected what comes from AuditLog, the only place an
  // INDIVIDUAL officer (not just a role) is ever attributable to a decision
  // - WorkflowStep itself only stores assignedRole. AuditLog.metadata is a
  // serialized JSON *text* column (not portably query-able across
  // SQLite/Postgres), so the "time from request submission to this
  // decision" correlation against Workflow.createdAt happens in JS after
  // fetching, not via a SQL join - same small-dataset convention this
  // codebase already uses elsewhere (e.g. ChangeDetectionService,
  // SpatialService's fetch-and-filter-in-JS helpers).
  async getOfficerMonitoring(): Promise<OfficerMonitoringEntry[]> {
    const officers = await this.userRepository.find({ where: { role: In([...OFFICER_ROLES]) }, order: { name: 'ASC' } });

    const pendingByRole = await this.workflowStepRepository
      .createQueryBuilder('step')
      .select('step.assignedRole', 'key')
      .addSelect('COUNT(*)', 'count')
      .where('step.status = :status', { status: 'PENDING' })
      .groupBy('step.assignedRole')
      .getRawMany<{ key: string; count: string }>();
    const pendingCountByRole = new Map(pendingByRole.map((row) => [row.key, Number(row.count)]));

    const decisionLogs = await this.auditLogRepository.find({
      where: { action: In(['WORKFLOW_STEP_APPROVED', 'WORKFLOW_STEP_REJECTED']) },
    });
    // id + createdAt only - this mock never has more than a few hundred
    // workflows (same assumption WorkflowsService.findAll's own comment
    // makes), so an id->createdAt map fits comfortably in memory.
    const workflows = await this.workflowRepository.find({ select: ['id', 'createdAt'] });
    const workflowCreatedAtById = new Map(workflows.map((w) => [w.id, w.createdAt]));

    interface Agg {
      approvedCount: number;
      rejectedCount: number;
      totalDecisionHours: number;
      decidedWithKnownWorkflowCount: number;
      lastActivityAt: Date;
    }
    const byUserId = new Map<string, Agg>();
    for (const log of decisionLogs) {
      const agg = byUserId.get(log.userId) ?? {
        approvedCount: 0,
        rejectedCount: 0,
        totalDecisionHours: 0,
        decidedWithKnownWorkflowCount: 0,
        lastActivityAt: log.createdAt,
      };
      if (log.action === 'WORKFLOW_STEP_APPROVED') agg.approvedCount += 1;
      else agg.rejectedCount += 1;
      if (log.createdAt > agg.lastActivityAt) agg.lastActivityAt = log.createdAt;

      const metadata: { workflowId?: string } | null = log.metadata ? JSON.parse(log.metadata) : null;
      const workflowCreatedAt = metadata?.workflowId ? workflowCreatedAtById.get(metadata.workflowId) : undefined;
      if (workflowCreatedAt) {
        agg.totalDecisionHours += (log.createdAt.getTime() - workflowCreatedAt.getTime()) / (1000 * 60 * 60);
        agg.decidedWithKnownWorkflowCount += 1;
      }
      byUserId.set(log.userId, agg);
    }

    return officers.map((officer) => {
      const agg = byUserId.get(officer.id);
      return {
        userId: officer.id,
        name: officer.name,
        role: officer.role,
        department: ROLE_DEPARTMENT[officer.role] ?? officer.role,
        pendingInRoleQueue: pendingCountByRole.get(officer.role) ?? 0,
        approvedCount: agg?.approvedCount ?? 0,
        rejectedCount: agg?.rejectedCount ?? 0,
        avgDecisionHours:
          agg && agg.decidedWithKnownWorkflowCount > 0
            ? Math.round((agg.totalDecisionHours / agg.decidedWithKnownWorkflowCount) * 10) / 10
            : null,
        lastActivityAt: agg?.lastActivityAt.toISOString() ?? null,
      };
    });
  }
}
