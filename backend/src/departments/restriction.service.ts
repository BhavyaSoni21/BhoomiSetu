import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestrictionRecord } from './restriction-record.entity';

@Injectable()
export class RestrictionService {
  constructor(
    @InjectRepository(RestrictionRecord)
    private readonly repository: Repository<RestrictionRecord>,
  ) {}

  async findByParcelId(parcelId: string): Promise<RestrictionRecord | null> {
    return this.repository.findOneBy({ parcelId });
  }
}
