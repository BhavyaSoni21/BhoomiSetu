import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { TaxRecord } from '../departments/tax-record.entity';
import { DisputeRecord } from '../departments/dispute-record.entity';
import { RestrictionRecord } from '../departments/restriction-record.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { PredictiveAnalyticsController } from './predictive-analytics.controller';
import { PredictiveAnalyticsService } from './predictive-analytics.service';

// Registers its own read-only repositories (same leaf-module pattern as
// AnalyticsModule/AiModule/ChangeDetectionModule) and exports the service so
// ParcelsModule can mount a single-parcel risk-score route alongside its
// existing /360 and /context routes without creating an import cycle - the
// same shape InteroperabilityModule already uses for ResponseAggregatorService.
@Module({
  imports: [TypeOrmModule.forFeature([Parcel, TaxRecord, DisputeRecord, RestrictionRecord, GovernanceAlert])],
  controllers: [PredictiveAnalyticsController],
  providers: [PredictiveAnalyticsService],
  exports: [PredictiveAnalyticsService],
})
export class PredictiveAnalyticsModule {}
