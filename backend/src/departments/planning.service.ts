import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanningRecord } from './planning-record.entity';

@Injectable()
export class PlanningService {
  constructor(
    @InjectRepository(PlanningRecord)
    private readonly repository: Repository<PlanningRecord>,
  ) {}

  async findByParcelId(parcelId: string): Promise<PlanningRecord | null> {
    return this.repository.findOneBy({ parcelId });
  }
}
