import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async create(params: { email: string; passwordHash: string; name: string; role: string }): Promise<User> {
    return this.repository.save(params);
  }

  async updateRole(id: string, role: string): Promise<User | null> {
    const user = await this.repository.findOneBy({ id });
    if (!user) return null;
    user.role = role;
    return this.repository.save(user);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
