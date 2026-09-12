import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisputeRecord } from './dispute-record.entity';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(DisputeRecord)
    private readonly repository: Repository<DisputeRecord>,
  ) {}

  async findByParcelId(parcelId: string): Promise<DisputeRecord | null> {
    return this.repository.findOneBy({ parcelId });
  }
}
