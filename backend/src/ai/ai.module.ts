import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { PlanningRecord } from '../departments/planning-record.entity';
import { RegistrationRecord } from '../departments/registration-record.entity';
import { InteroperabilityModule } from '../interoperability/interoperability.module';
import { GovernanceModule } from '../governance/governance.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GroqModule } from './groq.module';

// Registers its own repositories (rather than importing DepartmentsModule)
// for the same reason InteroperabilityModule does: AiModule only needs to
// READ these tables to execute a validated filter, not the department
// services' business logic, and it keeps AiModule a pure leaf module -
// nothing needs to import AiModule back. GroqService moved into its own
// GroqModule (2026-09-09) so WorkflowsModule can reuse it too.
@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, TaxRecord, RestrictionRecord, PlanningRecord, RegistrationRecord]),
    InteroperabilityModule,
    GovernanceModule,
    GroqModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
