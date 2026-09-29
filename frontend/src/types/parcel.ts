export interface ParcelSummary {
  id: string;
  canonicalParcelId: string | null;
  ulpin: string | null;
  stateCode: string;
  districtCode: string;
  localBodyCode: string;
  areaSqM: number;
  geometry: string;
  streetAddress?: string | null;
  locality?: string | null;
  landmark?: string | null;
  pincode?: string | null;
  status?: string; // 'Registered' | 'Pending Verification' | 'Rejected'
  localId?: string | null;
  verificationReport?: string | null;
  /** Property Tax Status layer. e.g. 'PAID' | 'OVERDUE' | 'DUE'. */
  taxStatus?: string | null;
  legalStatusSeverity?: number;
  legal_status_severity?: number;
  /** Circle Rate Heatmap layer (Layer 3). 0=no data, 1–5 increasing ₹/sqm. */
  valueBand?: number;
  value_band?: number;
  /** Composite Risk Score layer (Layer 4). 0.0 to 100.0. */
  riskScore?: number;
  risk_score?: number;
  /** Master Plan Mismatch layer (Layer 5): current use differs from proposed future land use. */
  masterplanMismatch?: boolean;
  masterplan_mismatch?: boolean;
  /** Unauthorized-construction flag, set by a change-detection run. */
  unauthorizedConstructionSuspected?: boolean;
  unauthorized_construction_suspected?: boolean;
}

export interface FieldMatchResult {
  field: string;
  label?: string;
  user: string;
  doc: string;
  match: boolean;
  score: number;
  type: 'exact' | 'fuzzy';
}

export interface VerificationResult {
  verdict: 'VERIFIED' | 'PARTIAL MATCH' | 'MISMATCH' | 'FAKE-LIKELY';
  documentCheck: {
    verdict: 'REAL' | 'SUSPICIOUS' | 'FAKE-LIKELY';
    score: number;
    signals?: Record<string, any>;
  };
  localId: string;
  matchPercent: number;
  matchedCount: number;
  totalFields: number;
  fieldResults: FieldMatchResult[];
  extractedDoc?: Record<string, any>;
  extractedTextPreview?: string;
  parcel?: ParcelSummary;
}

export function parseParcelGeometry(geometry: string | GeoJSON.Geometry): GeoJSON.Geometry {
  return typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
}

