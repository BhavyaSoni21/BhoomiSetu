import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { GovernanceAlert } from './governance-alert.entity';
import { User } from '../users/user.entity';
import { DEPARTMENT_ROLE } from '../auth/roles.constants';
import { NotificationFeedService } from '../notification-feed/notification-feed.service';

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
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;

    return this.alertRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<GovernanceAlert | null> {
    return this.alertRepository.findOneBy({ id });
  }

  async updateStatus(id: string, status: string, reason: string): Promise<GovernanceAlert | null> {
    const alert = await this.alertRepository.findOneBy({ id });
    if (!alert) return null;

    alert.status = status;
    alert.reason = reason;
    const saved = await this.alertRepository.save(alert);

    if (status === 'REVIEWED' || status === 'DISMISSED') {
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

    const verb = alert.status === 'DISMISSED' ? 'dismissed' : 'reviewed';
    await this.notificationFeedService.notifyUsers(
      officers.map((officer) => officer.id),
      {
        type: alert.status === 'DISMISSED' ? 'GOVERNANCE_ALERT_DISMISSED' : 'GOVERNANCE_ALERT_REVIEWED',
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
