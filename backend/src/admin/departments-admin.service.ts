import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';

@Injectable()
export class DepartmentsAdminService {
  constructor(
    @InjectRepository(Department)
    private readonly repository: Repository<Department>,
  ) {}

  async findAll(): Promise<Department[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  async findByCode(code: string): Promise<Department | null> {
    return this.repository.findOneBy({ code });
  }

  async create(data: { code: string; name: string; description?: string; contactEmail?: string; contactPhone?: string }): Promise<Department> {
    return this.repository.save({
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
    });
  }

  async update(id: string, data: { name?: string; description?: string; contactEmail?: string; contactPhone?: string }): Promise<Department | null> {
    const department = await this.repository.findOneBy({ id });
    if (!department) return null;
    Object.assign(department, data);
    return this.repository.save(department);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
