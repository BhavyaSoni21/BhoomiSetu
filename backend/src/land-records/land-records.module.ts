import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StateALandRecord } from './state-a-land-record.entity';
import { StateBLandRecord } from './state-b-land-record.entity';
import { StateALandRecordsController } from './state-a-land-records.controller';
import { StateBLandRecordsController } from './state-b-land-records.controller';
import { StateALandRecordsService } from './state-a-land-records.service';
import { StateBLandRecordsService } from './state-b-land-records.service';

@Module({
  imports: [TypeOrmModule.forFeature([StateALandRecord, StateBLandRecord])],
  controllers: [StateALandRecordsController, StateBLandRecordsController],
  providers: [StateALandRecordsService, StateBLandRecordsService],
})
export class LandRecordsModule {}
