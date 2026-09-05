import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';
import { Parcel } from './parcel.entity';
import { ParcelIdentifier } from './parcel-identifier.entity';
import { ParcelNeighbour } from './parcel-neighbour.entity';
import { InteroperabilityModule } from '../interoperability/interoperability.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { PredictiveAnalyticsModule } from '../predictive-analytics/predictive-analytics.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, ParcelIdentifier, ParcelNeighbour]),
    InteroperabilityModule,
    WorkflowsModule,
    PredictiveAnalyticsModule,
    AuditModule,
  ],
  controllers: [ParcelsController],
  providers: [ParcelsService],
})
export class ParcelsModule {}