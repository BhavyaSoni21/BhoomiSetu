import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrationRecord } from './registration-record.entity';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectRepository(RegistrationRecord)
    private readonly repository: Repository<RegistrationRecord>,
  ) {}

  async findByParcelId(parcelId: string): Promise<RegistrationRecord | null> {
    return this.repository.findOneBy({ parcelId });
  }
}
