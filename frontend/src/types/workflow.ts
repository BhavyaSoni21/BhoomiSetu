// Shape of the Workflow API (backend/src/workflows) - citizen service
// requests, e.g. a request for a copy of the RoR or a correction request.

export interface WorkflowStep {
  id: string;
  stepOrder: number;
  department: string;
  assignedRole: string;
  status: string;
  action: string | null;
  remarks: string | null;
  completedAt: string | null;
}

// Automatic OCR pre-check for LAND_CLAIM_REQUEST/DOCUMENT_VERIFICATION_REQUEST
// (WorkflowsService.buildVerificationPrecheck) - shown to the reviewing
// officer as an aid, never an instant citizen-facing verdict.
export interface VerificationPrecheck {
  verdict: 'MATCHED' | 'PARTIAL_MATCH' | 'MISMATCH' | 'NO_DOCUMENT_ON_FILE';
  checks: Array<{ field: string; expectedValue: string; status: 'MATCHED' | 'MISMATCH' }>;
}

export interface Workflow {
  id: string;
  parcelId: string;
  workflowType: string;
  currentStatus: string;
  createdBy: string | null;
  requestDetails: string | null;
  lastRemarks: string | null;
  // Snapshotted from the citizen's profile at creation (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up, "simplified Raise Request") - shown to the reviewing officer.
  // Set by an Admin via PATCH /workflows/{id}/assign-verifier - null until
  // a Verifier is assigned to make the field visit.
  assignedVerifierId: string | null;
  // Deterministic per workflowType (backend/app/models/workflow.py's
  // FIELD_VERIFICATION_WORKFLOW_TYPES) - false for desk-only requests like
  // ROR_COPY_REQUEST that never need a Verifier's field visit.
  requiresFieldVerification: boolean;
  applicantContact: string | null;
  applicantAddress: string | null;
  // JSON string (Workflow.verificationPrecheck is a plain text column) -
  // parse with JSON.parse to get a VerificationPrecheck, only ever set for
  // LAND_CLAIM_REQUEST/DOCUMENT_VERIFICATION_REQUEST.
  verificationPrecheck: string | null;
  // A citizen-submitted file attached to this specific request (docs/FRONTEND_UPGRADE_SPEC.md
  // follow-up, "upload-first Land Claim") - distinct from the parcel's own
  // ParcelDocument, e.g. a Dispute Filing's evidence never becomes the
  // parcel's official record. evidenceFileName is non-null whenever a file
  // was attached (evidenceMimeType covers content-type for display).
  evidenceFileName: string | null;
  evidenceMimeType: string | null;
  // OpenCV tamper/authenticity heuristic (BACKLOG.md item 15) - a soft
  // signal, not a hard accept/reject gate. evidenceAuthenticityReasons is a
  // JSON string (list[str]) same convention as verificationPrecheck.
  evidenceAuthenticitySuspicious: boolean | null;
  evidenceAuthenticityReasons: string | null;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}

// A Verifier's field-visit evidence for one workflow - geotagged photo +
// timestamp + notes, reviewed by staff before a workflow step is decided.
export interface FieldEvidence {
  id: string;
  workflowId: string;
  verifierId: string;
  photoFileName: string;
  mimeType: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
  notes: string | null;
  createdAt: string;
}
