import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../parcels/parcel.entity';
import { ParcelIdentifier } from '../parcels/parcel-identifier.entity';
import { StateALandRecord } from '../land-records/state-a-land-record.entity';
import { StateBLandRecord } from '../land-records/state-b-land-record.entity';
import { findIdentifierValue } from '../common/identifier-utils';

export interface LandRecordsLookupResult {
  source: 'STATE_A' | 'STATE_B';
  schema: string;
  identifierUsed: { type: string; value: string };
  data: StateALandRecord | StateBLandRecord;
}

// Mock Land Records Department API facade (Tech.md #16.1): given a parcel,
// find its record in whichever state-specific schema (Phase 3) applies -
// MH parcels resolve via their SURVEY_NUMBER identifier into
// state_a_land_records, DL parcels via PLOT_NUMBER into
// state_b_land_records. There's no stored parcel<->record link (Phase 3 was
// deliberate about that - real department systems don't share BhoomiSetu's
// internal keys); this is the minimal identifier-based join needed to
// "expose land record data (state-specific)" by parcel, and is exactly the
// kind of resolution Phase 5's formal Identifier Resolver will generalize.
// TN/KA have no state schema in this mock, so they resolve to null.
@Injectable()
export class LandRecordsLookupService {
  constructor(
    @InjectRepository(Parcel) private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelIdentifier) private readonly identifierRepository: Repository<ParcelIdentifier>,
    @InjectRepository(StateALandRecord) private readonly stateARepository: Repository<StateALandRecord>,
    @InjectRepository(StateBLandRecord) private readonly stateBRepository: Repository<StateBLandRecord>,
  ) {}

  async findByParcelId(parcelId: string): Promise<LandRecordsLookupResult | null | 'PARCEL_NOT_FOUND'> {
    const parcel = await this.parcelRepository.findOneBy({ id: parcelId });
    if (!parcel) return 'PARCEL_NOT_FOUND';

    if (parcel.stateCode === 'MH') return this.resolveStateA(parcelId);
    if (parcel.stateCode === 'DL') return this.resolveStateB(parcelId);
    return null;
  }

  private async resolveStateA(parcelId: string): Promise<LandRecordsLookupResult | null> {
    const surveyNumber = await findIdentifierValue(this.identifierRepository, parcelId, 'SURVEY_NUMBER');
    if (!surveyNumber) return null;

    const record = await this.stateARepository.findOneBy({ surveyNumber });
    if (!record) return null;

    return {
      source: 'STATE_A',
      schema: 'state_a_land_records',
      identifierUsed: { type: 'SURVEY_NUMBER', value: surveyNumber },
      data: record,
    };
  }

  private async resolveStateB(parcelId: string): Promise<LandRecordsLookupResult | null> {
    const plotId = await findIdentifierValue(this.identifierRepository, parcelId, 'PLOT_NUMBER');
    if (!plotId) return null;

    const record = await this.stateBRepository.findOneBy({ plotId });
    if (!record) return null;

    return {
      source: 'STATE_B',
      schema: 'state_b_land_records',
      identifierUsed: { type: 'PLOT_NUMBER', value: plotId },
      data: record,
    };
  }
}
