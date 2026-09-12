// Shape of the Historical Imagery API (backend/src/historical-imagery) -
// docs/FRONTEND_UPGRADE_SPEC.md §8. Mirrors backend/src/common/parcel-generation/parcel-category.ts's
// ParcelCategory - duplicated rather than shared, matching this codebase's
// existing convention for enum-like constants across the backend/frontend
// boundary (see backend/src/auth/roles.constants.ts).

export type ParcelCategory = 'NONE' | 'RESTRICTED' | 'DISPUTE_OWNERSHIP' | 'DISPUTE_BOUNDARY' | 'DISPUTE_INHERITANCE' | 'DISPUTE_ENCROACHMENT';

export interface ClusterSummary {
  clusterId: string;
  years: number[];
}

export interface AffectedParcelResult {
  parcelId: string;
  canonicalParcelId: string;
  fromCategory: ParcelCategory;
  toCategory: ParcelCategory;
  narrative: string;
  alertId: string | null;
}

export interface HistoricalComparisonResult {
  clusterId: string;
  fromYear: number;
  toYear: number;
  changeDetected: boolean;
  affectedParcels: AffectedParcelResult[];
}

// GET /historical-imagery/clusters/:clusterId/years/:year/parcels - real
// parcel geometry + a real ParcelCategory for one year, for rendering on the
// live map (features/map/MapComponent.tsx) rather than the flat snapshot PNG.
export interface CategorizedParcel {
  id: string;
  canonicalParcelId: string | null;
  ulpin: string | null;
  stateCode: string;
  districtCode: string;
  localBodyCode: string;
  areaSqM: number;
  geometry: string;
  category: ParcelCategory;
}
