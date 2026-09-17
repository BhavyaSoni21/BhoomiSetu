export interface ParcelSummary {
  id: string;
  canonicalParcelId: string | null;
  ulpin: string | null;
  stateCode: string;
  districtCode: string;
  localBodyCode: string;
  areaSqM: number;
  geometry: string;
  status?: string; // 'Registered' | 'Pending Verification' | 'Rejected'
  localId?: string | null;
  verificationReport?: string | null;
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

