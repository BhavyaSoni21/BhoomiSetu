import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { GovernanceAlert } from './governance-alert.entity';

@Injectable()
export class GovernanceAlertsService {
  constructor(
    @InjectRepository(GovernanceAlert) private readonly alertRepository: Repository<GovernanceAlert>,
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

  async updateStatus(id: string, status: string): Promise<GovernanceAlert | null> {
    const alert = await this.alertRepository.findOneBy({ id });
    if (!alert) return null;

    alert.status = status;
    return this.alertRepository.save(alert);
  }
}
