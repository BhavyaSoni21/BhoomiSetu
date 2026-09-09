import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, In, Repository } from 'typeorm';
import { GovernanceAlert } from './governance-alert.entity';
import { User } from '../users/user.entity';
import { DEPARTMENT_ROLE } from '../auth/roles.constants';
import { NotificationFeedService } from '../notification-feed/notification-feed.service';

// Four verification stages (docs/ADMIN_PANEL_ISSUES.md Officer #4): a linear
// OPEN -> ACKNOWLEDGED -> FIELD_VERIFIED -> RESOLVED progression, with
// DISMISSED reachable from any of the first three as an early exit for a
// false alarm. RESOLVED/DISMISSED are terminal - an empty array here, same
// as WorkflowsService.reviewStep's "a step can only be decided once" rule.
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED', 'DISMISSED'],
  ACKNOWLEDGED: ['FIELD_VERIFIED', 'DISMISSED'],
  FIELD_VERIFIED: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};

// Alerts still needing attention - OPEN/ACKNOWLEDGED/FIELD_VERIFIED, i.e.
// anything not yet closed. Used both by findAll's `status=ACTIVE` special
// case and by AnalyticsService's "Open Alerts" total.
export const CLOSED_ALERT_STATUSES = ['RESOLVED', 'DISMISSED'];

// Which department an alert concerns, derived from its existing alertType -
// no new manual field needed. Used to notify that department's officer(s)
// when the alert is reviewed/dismissed (the "connected internally with the
// different departments" ask), and to show a department badge on the
// frontend. UNAUTHORIZED_CHANGE_DETECTED has no single obvious department -
// LAND_RECORDS is the closest owner (title/boundary records), matching how
// the historical-imagery redesign already treats an unexplained boundary
// change as a records-integrity concern first.
const ALERT_TYPE_DEPARTMENT: Record<string, string> = {
  RESTRICTION_ZONE_OVERLAP: 'RESTRICTION',
  RESTRICTION_DETECTED: 'RESTRICTION',
  TAX_OVERDUE: 'TAX',
  DISPUTE_DETECTED: 'DISPUTE',
  UNAUTHORIZED_CHANGE_DETECTED: 'LAND_RECORDS',
};

export function alertDepartmentFor(alertType: string): string | null {
  return ALERT_TYPE_DEPARTMENT[alertType] ?? null;
}

@Injectable()
export class GovernanceAlertsService {
  constructor(
    @InjectRepository(GovernanceAlert) private readonly alertRepository: Repository<GovernanceAlert>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly notificationFeedService: NotificationFeedService,
  ) {}

  async findAll(filters: { status?: string; severity?: string }): Promise<GovernanceAlert[]> {
    const where: FindOptionsWhere<GovernanceAlert> = {};
    // ACTIVE is a pseudo-status, not a real column value - "still needs
    // attention" now spans 3 real statuses (OPEN/ACKNOWLEDGED/FIELD_VERIFIED)
    // since the 4-stage rework, not just OPEN.
    if (filters.status === 'ACTIVE') where.status = Not(In(CLOSED_ALERT_STATUSES));
    else if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;

    return this.alertRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<GovernanceAlert | null> {
    return this.alertRepository.findOneBy({ id });
  }

  async updateStatus(id: string, status: string, reason: string): Promise<GovernanceAlert | null> {
    const alert = await this.alertRepository.findOneBy({ id });
    if (!alert) return null;

    const reachable = VALID_TRANSITIONS[alert.status] ?? [];
    if (!reachable.includes(status)) {
      throw new BadRequestException(
        reachable.length > 0
          ? `Cannot move a "${alert.status}" alert directly to "${status}" - the next stage(s) from here are: ${reachable.join(', ')}.`
          : `This alert is already "${alert.status}" and can't be moved to another stage.`,
      );
    }

    alert.status = status;
    alert.reason = reason;
    const saved = await this.alertRepository.save(alert);

    // Only notify on final closure (RESOLVED/DISMISSED), not on every
    // intermediate stage - ACKNOWLEDGED/FIELD_VERIFIED would otherwise spam
    // the department for progress that isn't a decision yet.
    if (status === 'RESOLVED' || status === 'DISMISSED') {
      await this.notifyDepartmentOfReview(saved);
    }

    return saved;
  }

  private async notifyDepartmentOfReview(alert: GovernanceAlert): Promise<void> {
    const department = alertDepartmentFor(alert.alertType);
    const role = department ? DEPARTMENT_ROLE[department] : null;
    if (!role) return;

    const officers = await this.userRepository.find({ where: { role } });
    if (officers.length === 0) return;

    const verb = alert.status === 'DISMISSED' ? 'dismissed' : 'resolved';
    await this.notificationFeedService.notifyUsers(
      officers.map((officer) => officer.id),
      {
        type: alert.status === 'DISMISSED' ? 'GOVERNANCE_ALERT_DISMISSED' : 'GOVERNANCE_ALERT_RESOLVED',
        title: `A ${department} alert was ${verb}`,
        // reason is mandatory as of 2026-09-09 (UpdateGovernanceAlertStatusDto),
        // so it's always real text here - no fallback needed.
        message: `${alert.alertType.replace(/_/g, ' ')} was ${verb}. ${alert.reason}`,
        parcelId: alert.parcelId,
        alertId: alert.id,
      },
    );
  }
}
