import { Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { DepartmentsAdminService } from './departments-admin.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { User } from '../users/user.entity';

// Admin-only (docs/FRONTEND_UPGRADE_SPEC.md §7's "Departments" piece of
// Phase 3) - a small admin-editable department directory (name/description/
// contact info), separate from the six mock department domain modules under
// src/departments/ (those keep working unchanged - see department.entity.ts
// for why). Every mutation is audit-logged, matching UsersController's
// established convention for this same admin-CRUD-with-audit-trail shape.
@Controller('admin/departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DepartmentsAdminController {
  constructor(
    private readonly departmentsService: DepartmentsAdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async findAll() {
    return this.departmentsService.findAll();
  }

  @Post()
  async create(@CurrentUser() actingUser: User, @Body() dto: CreateDepartmentDto) {
    const existing = await this.departmentsService.findByCode(dto.code);
    if (existing) {
      throw new ConflictException('A department with this code already exists');
    }

    const created = await this.departmentsService.create(dto);
    await this.auditService.log({
      userId: actingUser.id,
      userRole: actingUser.role,
      action: 'DEPARTMENT_CREATED',
      entityType: 'DEPARTMENT',
      entityId: created.id,
      metadata: { code: created.code, name: created.name },
    });
    return created;
  }

  @Patch(':id')
  async update(@CurrentUser() actingUser: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    const updated = await this.departmentsService.update(id, dto);
    if (!updated) {
      throw new NotFoundException(`Department not found: ${id}`);
    }

    await this.auditService.log({
      userId: actingUser.id,
      userRole: actingUser.role,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'DEPARTMENT',
      entityId: id,
      metadata: { ...dto },
    });
    return updated;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() actingUser: User, @Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.departmentsService.remove(id);
    if (!deleted) {
      throw new NotFoundException(`Department not found: ${id}`);
    }

    await this.auditService.log({
      userId: actingUser.id,
      userRole: actingUser.role,
      action: 'DEPARTMENT_DELETED',
      entityType: 'DEPARTMENT',
      entityId: id,
    });
  }
}
