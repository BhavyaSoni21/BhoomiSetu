import { Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, BadRequestException, UseGuards } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserRoleDto } from './dto/user.dto';
import { User } from './user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditService } from '../audit/audit.service';

// Never return passwordHash to a client - mirrors AuthService.toPublicUser,
// duplicated rather than shared across the UsersModule/AuthModule boundary
// (same convention as this codebase's other small cross-module overlaps).
function toPublicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
}

// Admin-only throughout (docs/FEATURE_AUDIT.md §8 item 11 - Tech.md §38's
// "User Management"/"Role Management" for the Admin role). Every mutation is
// audit-logged (§8 item 10) and an admin can't change their own role or
// delete their own account through this endpoint, to avoid a self-lockout.
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(toPublicUser);
  }

  @Post()
  async create(@CurrentUser() actingUser: User, @Body() dto: CreateUserDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const created = await this.usersService.create({
      email: dto.email,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      name: dto.name,
      role: dto.role,
    });

    await this.auditService.log({
      userId: actingUser.id,
      userRole: actingUser.role,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: created.id,
      metadata: { email: created.email, role: created.role },
    });
    return toPublicUser(created);
  }

  @Patch(':id/role')
  async updateRole(@CurrentUser() actingUser: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserRoleDto) {
    if (id === actingUser.id) {
      throw new BadRequestException('You cannot change your own role');
    }

    const updated = await this.usersService.updateRole(id, dto.role);
    if (!updated) {
      throw new NotFoundException(`User not found: ${id}`);
    }

    await this.auditService.log({
      userId: actingUser.id,
      userRole: actingUser.role,
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: id,
      metadata: { newRole: dto.role },
    });
    return toPublicUser(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() actingUser: User, @Param('id', ParseUUIDPipe) id: string) {
    if (id === actingUser.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const deleted = await this.usersService.remove(id);
    if (!deleted) {
      throw new NotFoundException(`User not found: ${id}`);
    }

    await this.auditService.log({
      userId: actingUser.id,
      userRole: actingUser.role,
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: id,
    });
  }
}
