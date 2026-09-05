import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface LogParams {
  userId: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  parcelId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditLogView extends Omit<AuditLog, 'metadata'> {
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  // Fire-and-forget from the caller's perspective (still awaited so a write
  // failure surfaces rather than being silently lost), but never blocks the
  // actual action it's recording - callers invoke this after their own
  // mutation has already succeeded, so a logging problem never rolls back a
  // real workflow/alert decision.
  async log(params: LogParams): Promise<void> {
    await this.repository.save({
      userId: params.userId,
      userRole: params.userRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      parcelId: params.parcelId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  }

  async findAll(filters: { entityType?: string; userId?: string }): Promise<AuditLogView[]> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.userId) where.userId = filters.userId;

    const rows = await this.repository.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((row) => this.parseMetadata(row));
  }

  async findByParcel(parcelId: string): Promise<AuditLogView[]> {
    const rows = await this.repository.find({ where: { parcelId }, order: { createdAt: 'DESC' } });
    return rows.map((row) => this.parseMetadata(row));
  }

  private parseMetadata(row: AuditLog): AuditLogView {
    return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : null };
  }
}
