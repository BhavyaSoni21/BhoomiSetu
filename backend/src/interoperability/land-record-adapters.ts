import { StateALandRecord } from '../land-records/state-a-land-record.entity';
import { StateBLandRecord } from '../land-records/state-b-land-record.entity';
import { LandRecordsLookupResult } from '../departments/land-records-lookup.service';

const SQM_PER_HECTARE = 10000;
const SQFT_PER_SQM = 10.7639;

export interface AdaptedLandRecord {
  sourceSchema: 'STATE_A' | 'STATE_B';
  sourceIdentifier: string;
  ownerName: string;
  areaSqM: number;
  locality: string;
  raw: StateALandRecord | StateBLandRecord;
}

// Tech.md #14 "State Adapter Mapping" - State A: survey_number ->
// source_identifier, owner_name -> ownership.owner_name, area_hectares ->
// area_sq_m.
export function adaptStateA(record: StateALandRecord): AdaptedLandRecord {
  return {
    sourceSchema: 'STATE_A',
    sourceIdentifier: record.surveyNumber,
    ownerName: record.ownerName,
    areaSqM: Math.round(record.areaHectares * SQM_PER_HECTARE * 100) / 100,
    locality: record.villageCode,
    raw: record,
  };
}

// Tech.md #14 State B: plot_id -> source_identifier, holder_name ->
// ownership.owner_name, land_extent_sqft -> area_sq_m.
export function adaptStateB(record: StateBLandRecord): AdaptedLandRecord {
  return {
    sourceSchema: 'STATE_B',
    sourceIdentifier: record.plotId,
    ownerName: record.holderName,
    areaSqM: Math.round((record.landExtentSqft / SQFT_PER_SQM) * 100) / 100,
    locality: record.localityId,
    raw: record,
  };
}

export function adaptLandRecordsResult(result: LandRecordsLookupResult): AdaptedLandRecord {
  return result.source === 'STATE_A'
    ? adaptStateA(result.data as StateALandRecord)
    : adaptStateB(result.data as StateBLandRecord);
}
