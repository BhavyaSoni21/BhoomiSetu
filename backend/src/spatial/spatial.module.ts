import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpatialController } from './spatial.controller';
import { SpatialService } from './spatial.service';
import { ZoningOverlay } from './zoning-overlay.entity';
import { RestrictionZone } from './restriction-zone.entity';
import { InfrastructureFeature } from './infrastructure-feature.entity';
import { ChangeDetectionEvent } from './change-detection-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ZoningOverlay, RestrictionZone, InfrastructureFeature, ChangeDetectionEvent])],
  controllers: [SpatialController],
  providers: [SpatialService],
})
export class SpatialModule {}
