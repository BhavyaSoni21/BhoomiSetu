import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';
import { StateALandRecord } from '../land-records/state-a-land-record.entity';
import { StateBLandRecord } from '../land-records/state-b-land-record.entity';
import { RegistrationRecord } from './registration-record.entity';
import { PlanningRecord } from './planning-record.entity';
import { TaxRecord } from './tax-record.entity';
import { RestrictionRecord } from './restriction-record.entity';
import { LandRecordsLookupController } from './land-records-lookup.controller';
import { LandRecordsLookupService } from './land-records-lookup.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import { RestrictionController } from './restriction.controller';
import { RestrictionService } from './restriction.service';

// The five mock department APIs (Tech.md #16-17), each independent of the
// others and of the canonical parcel model. Phase 5's /integrations layer
// will be the thing that calls into all five and aggregates them.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Parcel,
      ParcelIdentifier,
      StateALandRecord,
      StateBLandRecord,
      RegistrationRecord,
      PlanningRecord,
      TaxRecord,
      RestrictionRecord,
    ]),
  ],
  controllers: [LandRecordsLookupController, RegistrationController, PlanningController, TaxController, RestrictionController],
  providers: [LandRecordsLookupService, RegistrationService, PlanningService, TaxService, RestrictionService],
  // Exported so InteroperabilityModule's ResponseAggregatorService can call
  // into all five without duplicating their lookup logic. One-directional:
  // Departments never imports Interoperability, so there's no module cycle.
  exports: [LandRecordsLookupService, RegistrationService, PlanningService, TaxService, RestrictionService],
})
export class DepartmentsModule {}
