import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { StateBLandRecord } from './state-b-land-record.entity';
import { CreateStateBLandRecordDto, UpdateStateBLandRecordDto } from './dto/state-b-land-record.dto';

@Injectable()
export class StateBLandRecordsService {
  constructor(
    @InjectRepository(StateBLandRecord)
    private readonly repository: Repository<StateBLandRecord>,
  ) {}

  async create(dto: CreateStateBLandRecordDto): Promise<StateBLandRecord> {
    const record = this.repository.create(dto);
    return this.repository.save(record);
  }

  async findAll(filters: { plotId?: string; localityId?: string; limit?: number; offset?: number }) {
    const where: Partial<Record<'plotId' | 'localityId', string>> = {};
    if (filters.plotId) where.plotId = filters.plotId;
    if (filters.localityId) where.localityId = filters.localityId;

    const options: FindManyOptions<StateBLandRecord> = { where };
    if (filters.limit) options.take = Number(filters.limit);
    if (filters.offset) options.skip = Number(filters.offset);

    const [records, total] = await this.repository.findAndCount(options);
    return { records, total };
  }

  async findOne(id: string): Promise<StateBLandRecord | null> {
    return this.repository.findOneBy({ recordId: id });
  }

  async update(id: string, dto: UpdateStateBLandRecordDto): Promise<StateBLandRecord | null> {
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
