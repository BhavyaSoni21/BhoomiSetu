// Officer role/department/label lookups - pure domain constants, not auth
// mechanics. Real login/session state lives in features/auth/auth.ts as of
// Phase 10 (docs/FEATURE_AUDIT.md §8 item 9); this file previously also held
// a client-side-only "pick a name and role" simulated session with no
// backend behind it, now replaced by that real JWT-backed session.
export type OfficerRole =
  | 'LAND_RECORD_OFFICER'
  | 'REGISTRATION_OFFICER'
  | 'PLANNING_OFFICER'
  | 'DISPUTE_OFFICER'
  | 'TAX_OFFICER'
  | 'RESTRICTION_OFFICER'
  | 'ENCUMBRANCE_OFFICER';

export const OFFICER_ROLES: OfficerRole[] = [
  'LAND_RECORD_OFFICER',
  'REGISTRATION_OFFICER',
  'PLANNING_OFFICER',
  'DISPUTE_OFFICER',
  'TAX_OFFICER',
  'RESTRICTION_OFFICER',
  'ENCUMBRANCE_OFFICER',
];

export const ROLE_LABELS: Record<OfficerRole, string> = {
  LAND_RECORD_OFFICER: 'Land Record Officer',
  REGISTRATION_OFFICER: 'Registration Officer',
  PLANNING_OFFICER: 'Planning Officer',
  DISPUTE_OFFICER: 'Dispute Officer',
  TAX_OFFICER: 'Tax Officer',
  RESTRICTION_OFFICER: 'Restriction Officer',
  ENCUMBRANCE_OFFICER: 'Encumbrance Officer',
};

// A role reviews exactly the workflow_steps row for its own department -
// mirrors the ROLE_DEPARTMENT mapping in backend/src/auth/roles.constants.ts
// (also this module's own source of truth for the AI-routed departments -
// see RequestRoutingService).
export const ROLE_DEPARTMENT: Record<OfficerRole, string> = {
  LAND_RECORD_OFFICER: 'LAND_RECORDS',
  REGISTRATION_OFFICER: 'REGISTRATION',
  PLANNING_OFFICER: 'PLANNING',
  DISPUTE_OFFICER: 'DISPUTE',
  TAX_OFFICER: 'TAX',
  RESTRICTION_OFFICER: 'RESTRICTION',
  ENCUMBRANCE_OFFICER: 'ENCUMBRANCE',
};

// Field evidence collector - deliberately not an OfficerRole/in
// OFFICER_ROLES (mirrors backend-py/app/auth/roles.py's VERIFIER_ROLE):
// a Verifier reviews no department queue and has no workflow-step
// approve/reject access, so it doesn't belong in ROLE_DEPARTMENT either.
export const VERIFIER_ROLE = 'VERIFIER';
