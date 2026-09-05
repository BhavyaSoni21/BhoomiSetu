import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { RegistrationRecord } from '../departments/registration-record.entity';
import { PlanningRecord } from '../departments/planning-record.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { Workflow } from '../workflows/workflow.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { User } from '../users/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

// Registers its own read-only repositories rather than importing
// Departments/Workflows/Governance/Users/Audit - same leaf-module pattern as
// AiModule/ChangeDetectionModule: this module only ever reads across these
// tables, nothing needs to import it back.
@Module({
  imports: [TypeOrmModule.forFeature([Parcel, TaxRecord, RegistrationRecord, PlanningRecord, DisputeRecord, Workflow, GovernanceAlert, User, AuditLog])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
