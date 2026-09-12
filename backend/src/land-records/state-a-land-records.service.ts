import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { StateALandRecord } from './state-a-land-record.entity';
import { CreateStateALandRecordDto, UpdateStateALandRecordDto } from './dto/state-a-land-record.dto';

@Injectable()
export class StateALandRecordsService {
  constructor(
    @InjectRepository(StateALandRecord)
    private readonly repository: Repository<StateALandRecord>,
  ) {}

  async create(dto: CreateStateALandRecordDto): Promise<StateALandRecord> {
    const record = this.repository.create({ recordStatus: 'ACTIVE', ...dto });
    return this.repository.save(record);
  }

  async findAll(filters: { surveyNumber?: string; villageCode?: string; limit?: number; offset?: number }) {
    const where: Partial<Record<'surveyNumber' | 'villageCode', string>> = {};
    if (filters.surveyNumber) where.surveyNumber = filters.surveyNumber;
    if (filters.villageCode) where.villageCode = filters.villageCode;

    const options: FindManyOptions<StateALandRecord> = { where };
    if (filters.limit) options.take = Number(filters.limit);
    if (filters.offset) options.skip = Number(filters.offset);

    const [records, total] = await this.repository.findAndCount(options);
    return { records, total };
  }

  async findOne(id: string): Promise<StateALandRecord | null> {
    return this.repository.findOneBy({ recordId: id });
  }

  async update(id: string, dto: UpdateStateALandRecordDto): Promise<StateALandRecord | null> {
    const record = await this.repository.findOneBy({ recordId: id });
    if (!record) return null;
    Object.assign(record, dto);
    return this.repository.save(record);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repository.delete({ recordId: id });
    return (result.affected ?? 0) > 0;
  }
}
