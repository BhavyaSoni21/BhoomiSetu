// Shape of GET /api/v1/parcels/:id/360 (backend/src/interoperability).
// The identifiers/location/spatial/sources block is Tech.md #15's canonical
// envelope (snake_case, matching the spec verbatim); `departments` carries
// the real per-department payload, `null` where nothing is linked.

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

export interface AdaptedLandRecord {
  sourceSchema: 'STATE_A' | 'STATE_B';
  sourceIdentifier: string;
  ownerName: string;
  areaSqM: number;
  locality: string;
  raw: Record<string, unknown>;
}

export interface RegistrationRecord {
  id: string;
  parcelId: string;
  registrationStatus: string;
  registrationNumber: string | null;
  registrationDate: string | null;
  lastTransactionType: string | null;
  lastTransactionDate: string | null;
}

export interface PlanningRecord {
  id: string;
  parcelId: string;
  landUse: string;
  zoningClassification: string;
  masterPlanReference: string;
  buildingPermissionStatus: string;
}

export interface TaxRecord {
  id: string;
  parcelId: string;
  assessedValue: number;
  annualTaxAmount: number;
  taxStatus: string;
  outstandingAmount: number;
  lastPaymentDate: string | null;
  marketValueReference: number | null;
  valuationDate: string | null;
  valuationSource: string | null;
}

export interface RestrictionRecord {
  id: string;
  parcelId: string;
  hasRestriction: boolean;
  restrictionType: string | null;
  restrictionDetails: string | null;
  imposingAuthority: string | null;
}

export interface DisputeRecord {
  id: string;
  parcelId: string;
  hasActiveDispute: boolean;
  disputeType: string | null;
  caseStatus: string | null;
  filingDate: string | null;
  resolutionDate: string | null;
  resolutionSummary: string | null;
}

export interface EncumbranceRecord {
  id: string;
  parcelId: string;
  hasEncumbrance: boolean;
  encumbranceType: string | null;
  lenderName: string | null;
  instrumentReference: string | null;
  registeredDate: string | null;
  dischargeDate: string | null;
}

export interface OwnershipHistoryRecord {
  id: string;
  parcelId: string;
  ownerName: string;
  transactionType: string;
  transactionDate: string;
  documentReference: string | null;
}

export interface Parcel360Response {
  parcel_id: string;
  identifiers: CanonicalIdentifiers;
  location: { state: string; district: string; locality: string };
  spatial: { area_sq_m: number; geometry: GeoJSON.Geometry };
  sources: CanonicalSource[];
  departments: {
    landRecords: AdaptedLandRecord | null;
    registration: RegistrationRecord | null;
    planning: PlanningRecord | null;
    tax: TaxRecord | null;
    restriction: RestrictionRecord | null;
    dispute: DisputeRecord | null;
    encumbrance: EncumbranceRecord | null;
  };
}
