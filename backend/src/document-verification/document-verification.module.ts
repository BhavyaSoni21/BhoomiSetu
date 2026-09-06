import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';
import { DepartmentsModule } from '../departments/departments.module';
import { DocumentVerificationController } from './document-verification.controller';
import { DocumentVerificationService } from './document-verification.service';

// Registers its own Parcel/ParcelIdentifier repositories (rather than
// importing ParcelsModule) and imports DepartmentsModule for
// LandRecordsLookupService - same one-directional pattern as
// InteroperabilityModule, so nothing needs to import this module back.
@Module({
  imports: [TypeOrmModule.forFeature([Parcel, ParcelIdentifier]), DepartmentsModule],
  controllers: [DocumentVerificationController],
  providers: [DocumentVerificationService],
})
export class DocumentVerificationModule {}
