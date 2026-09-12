import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ChangeDetectionEvent } from '../spatial/change-detection-event.entity';
import { GovernanceAlert } from '../governance/governance-alert.entity';
import { ChangeDetectionController } from './change-detection.controller';
import { ChangeDetectionService } from './change-detection.service';

// Registers its own repositories (Parcel, ChangeDetectionEvent,
// GovernanceAlert) rather than importing SpatialModule/GovernanceModule -
// same pattern as Interoperability/Departments/Ai: this module only reads/
// writes these tables directly, nothing needs to import it back.
@Module({
  imports: [TypeOrmModule.forFeature([Parcel, ChangeDetectionEvent, GovernanceAlert])],
  controllers: [ChangeDetectionController],
  providers: [ChangeDetectionService],
})
export class ChangeDetectionModule {}
