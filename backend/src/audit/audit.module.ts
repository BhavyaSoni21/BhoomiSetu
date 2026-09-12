import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// Registers its own repository (same leaf-module pattern as
// AnalyticsModule/PredictiveAnalyticsModule) and exports AuditService so
// AuthModule (login events), WorkflowsModule, and GovernanceModule can each
// record audit entries without importing each other.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
