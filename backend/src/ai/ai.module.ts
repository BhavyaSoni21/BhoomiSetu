import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { CitizenParcel } from '../parcels/citizen-parcel.entity';
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
// GroqModule (2026-09-09) so WorkflowsModule can reuse it too. CitizenParcel
// added 2026-09-10 so AiService can run the same citizen-association check
// ParcelsController.getParcel360 does before handing Parcel 360 data to
// "Explain with AI" - a small duplicate of ParcelsService's own version
// rather than importing ParcelsModule, same convention WorkflowsModule
// already documents for its own citizen-association check.
@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, CitizenParcel, TaxRecord, RestrictionRecord, PlanningRecord, RegistrationRecord]),
    InteroperabilityModule,
    GovernanceModule,
    GroqModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
