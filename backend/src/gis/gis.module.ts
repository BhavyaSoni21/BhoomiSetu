import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GisController } from './gis.controller';
import { GisService } from './gis.service';
import { Parcel } from '../parcels/parcel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Parcel])],
  controllers: [GisController],
  providers: [GisService],
})
export class GisModule {}