import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './department.entity';
import { DepartmentsAdminService } from './departments-admin.service';
import { DepartmentsAdminController } from './departments-admin.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Department]), AuditModule],
  controllers: [DepartmentsAdminController],
  providers: [DepartmentsAdminService],
})
export class AdminModule {}
