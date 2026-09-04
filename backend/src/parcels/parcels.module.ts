import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';
import { Parcel } from './parcel.entity';
import { ParcelIdentifier } from './parcel-identifier.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Parcel, ParcelIdentifier])],
  controllers: [ParcelsController],
  providers: [ParcelsService],
})
export class ParcelsModule {}