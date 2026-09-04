import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';
import { DepartmentsModule } from '../departments/departments.module';
import { IdentifierResolverService } from './identifier-resolver.service';
import { ResponseAggregatorService } from './response-aggregator.service';

// Tech.md #22 / Plan.md Phase 5: identifier resolver, state adapters
// (land-record-adapters.ts), canonical transformer (canonical-transformer.ts),
// and response aggregator. Registers its own Parcel/ParcelIdentifier
// repositories (rather than importing ParcelsModule) and imports
// DepartmentsModule (one-directional - Departments never imports this back)
// specifically so ParcelsModule can import *this* module for its /360 route
// without creating a cycle.
@Module({
  imports: [TypeOrmModule.forFeature([Parcel, ParcelIdentifier]), DepartmentsModule],
  providers: [IdentifierResolverService, ResponseAggregatorService],
  exports: [IdentifierResolverService, ResponseAggregatorService],
})
export class InteroperabilityModule {}
