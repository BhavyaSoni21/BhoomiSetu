import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { RegistrationRecord } from '../departments/registration-record.entity';
import { PlanningRecord } from '../departments/planning-record.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { Workflow } from '../workflows/workflow.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { User } from '../users/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { ALL_STAFF_ROLES } from '../auth/roles.constants';

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
      this.alertRepository.count({ where: { status: 'OPEN' } }),
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
}
