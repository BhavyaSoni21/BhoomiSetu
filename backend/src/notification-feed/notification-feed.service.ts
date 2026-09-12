import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  parcelId?: string | null;
  workflowId?: string | null;
  alertId?: string | null;
}

@Injectable()
export class NotificationFeedService {
  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
  ) {}

  // Callers (WorkflowsService, GovernanceAlertsService) resolve their own
  // recipient user ids - this module deliberately doesn't know about roles
  // or departments, keeping it a pure leaf. One row per recipient, so each
  // officer's read state is independent even when several hold the same role.
  async notifyUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
    if (userIds.length === 0) return;
    await this.repository.save(
      userIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        parcelId: payload.parcelId ?? null,
        workflowId: payload.workflowId ?? null,
        alertId: payload.alertId ?? null,
      })),
    );
  }

  async findMine(userId: string): Promise<Notification[]> {
    return this.repository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    const notification = await this.repository.findOneBy({ id, userId });
    if (!notification) return null;
    notification.read = true;
    return this.repository.save(notification);
  }
}
