import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxRecord } from './tax-record.entity';

@Injectable()
export class TaxService {
  constructor(
    @InjectRepository(TaxRecord)
    private readonly repository: Repository<TaxRecord>,
  ) {}

  async findByParcelId(parcelId: string): Promise<TaxRecord | null> {
    return this.repository.findOneBy({ parcelId });
  }
}
