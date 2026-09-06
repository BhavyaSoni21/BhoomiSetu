// Shape returned by POST /api/v1/document-verification/verify.
export type FieldCheckStatus = 'MATCHED' | 'MISMATCH' | 'NOT_AVAILABLE';

export interface FieldCheck {
  field: string;
  expectedValue: string;
  status: FieldCheckStatus;
}

export type VerificationVerdict = 'VERIFIED' | 'PARTIAL_MATCH' | 'MISMATCH' | 'INSUFFICIENT_DATA';

export interface DocumentVerificationResult {
  parcelId: string;
  canonicalParcelId: string | null;
  extractedText: string;
  ocrConfidence: number;
  fieldChecks: FieldCheck[];
  overallVerdict: VerificationVerdict;
}
