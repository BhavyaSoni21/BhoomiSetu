import { Parcel } from '../parcels/parcel.entity';

export interface CanonicalIdentifiers {
  ulpin: string | null;
  survey_number: string | null;
  plot_number: string | null;
  local_identifier: string | null;
}

export interface CanonicalSource {
  department: string;
  status: 'AVAILABLE' | 'NOT_AVAILABLE';
}

export interface CanonicalParcelEnvelope {
  parcel_id: string;
  identifiers: CanonicalIdentifiers;
  location: { state: string; district: string; locality: string };
  spatial: { area_sq_m: number; geometry: any };
  sources: CanonicalSource[];
}

// Tech.md #15 "Canonical Parcel Response" - the standard structure every
// department response gets transformed into before aggregation. Deliberately
// snake_case, matching the spec's own JSON example verbatim, even though the
// rest of this API is camelCase - this is the one shape meant to be a fixed
// external contract, not an internal implementation detail.
export function buildCanonicalEnvelope(params: {
  parcel: Parcel;
  surveyNumber: string | null;
  plotNumber: string | null;
  localIdentifier: string | null;
  locality: string;
  sourceAvailability: Record<string, boolean>;
}): CanonicalParcelEnvelope {
  const { parcel, surveyNumber, plotNumber, localIdentifier, locality, sourceAvailability } = params;

  return {
    parcel_id: parcel.id,
    identifiers: {
      ulpin: parcel.ulpin,
      survey_number: surveyNumber,
      plot_number: plotNumber,
      local_identifier: localIdentifier,
    },
    location: {
      state: parcel.stateCode,
      district: parcel.districtCode,
      locality,
    },
    spatial: {
      area_sq_m: parcel.areaSqM,
      geometry: JSON.parse(parcel.geometry),
    },
    sources: Object.entries(sourceAvailability).map(([department, available]) => ({
      department,
      status: available ? 'AVAILABLE' : 'NOT_AVAILABLE',
    })),
  };
}
