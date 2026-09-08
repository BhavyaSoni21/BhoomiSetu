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
import { DisputeRecord } from './dispute-record.entity';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { EncumbranceRecord } from './encumbrance-record.entity';
import { EncumbranceController } from './encumbrance.controller';
import { EncumbranceService } from './encumbrance.service';

// The mock department APIs (Tech.md #16-17, plus Dispute added afterward to
// close the SIH problem statement's literal "land records, registration,
// dispute, planning, and fiscal" workflow list, plus Encumbrance added
// after that to close a required "essential layer" the fuller "Land Stack"
// PS text named - see docs/FEATURE_AUDIT.md §1a/§8 item 17), each
// independent of the others and of the canonical parcel model. Phase 5's
// /integrations layer is the thing that calls into all of them and
// aggregates them.
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
      DisputeRecord,
      EncumbranceRecord,
    ]),
  ],
  controllers: [
    LandRecordsLookupController,
    RegistrationController,
    PlanningController,
    TaxController,
    RestrictionController,
    DisputeController,
    EncumbranceController,
  ],
  providers: [LandRecordsLookupService, RegistrationService, PlanningService, TaxService, RestrictionService, DisputeService, EncumbranceService],
  // Exported so InteroperabilityModule's ResponseAggregatorService can call
  // into all of them without duplicating their lookup logic. One-directional:
  // Departments never imports Interoperability, so there's no module cycle.
  exports: [LandRecordsLookupService, RegistrationService, PlanningService, TaxService, RestrictionService, DisputeService, EncumbranceService],
})
export class DepartmentsModule {}
