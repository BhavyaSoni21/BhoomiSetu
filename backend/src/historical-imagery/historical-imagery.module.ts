import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClusterHistoricalSnapshot } from './cluster-historical-snapshot.entity';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelHistoricalState } from '../parcels/parcel-historical-state.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { HistoricalImageryController } from './historical-imagery.controller';
import { HistoricalComparisonService } from './historical-comparison.service';
import { NarrativeService } from './narrative.service';

// Registers its own Parcel/ParcelHistoricalState/DisputeRecord/
// RestrictionRecord/GovernanceAlert repositories rather than importing
// ParcelsModule/DepartmentsModule/GovernanceModule - same leaf-module
// convention as AiModule/ChangeDetectionModule, this only ever READS those
// tables (plus writes GovernanceAlert) to run a self-contained comparison,
// not their business logic.
@Module({
  imports: [
    TypeOrmModule.forFeature([ClusterHistoricalSnapshot, Parcel, ParcelHistoricalState, DisputeRecord, RestrictionRecord, GovernanceAlert]),
  ],
  controllers: [HistoricalImageryController],
  providers: [HistoricalComparisonService, NarrativeService],
})
export class HistoricalImageryModule {}
