import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './user.entity';
import { ALL_STAFF_ROLES } from '../auth/roles.constants';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  async findByMobileNumber(mobileNumber: string): Promise<User | null> {
    return this.repository.findOneBy({ mobileNumber });
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  // Staff only - this backs the Admin Portal's "User Management" list
  // (officer/admin account administration), which citizen accounts were
  // never part of. Without this filter, seeding citizen sign-in accounts
  // would silently spill them into that admin-only staff list.
  async findAll(): Promise<User[]> {
    return this.repository.find({ where: { role: In([...ALL_STAFF_ROLES]) }, order: { createdAt: 'DESC' } });
  }

  async create(params: {
    email?: string | null;
    mobileNumber?: string | null;
    passwordHash: string;
    name: string;
    role: string;
    emailVerified?: boolean;
    mobileVerified?: boolean;
  }): Promise<User> {
    return this.repository.save({
      email: params.email ?? null,
      mobileNumber: params.mobileNumber ?? null,
      emailVerified: params.emailVerified ?? false,
      mobileVerified: params.mobileVerified ?? false,
      passwordHash: params.passwordHash,
      name: params.name,
      role: params.role,
    });
  }

  async save(user: User): Promise<User> {
    return this.repository.save(user);
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
