import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EncumbranceRecord } from './encumbrance-record.entity';

@Injectable()
export class EncumbranceService {
  constructor(
    @InjectRepository(EncumbranceRecord)
    private readonly repository: Repository<EncumbranceRecord>,
  ) {}

  async findByParcelId(parcelId: string): Promise<EncumbranceRecord | null> {
    return this.repository.findOneBy({ parcelId });
  }
}
