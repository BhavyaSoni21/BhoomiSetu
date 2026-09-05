// Officer role/department/label lookups - pure domain constants, not auth
// mechanics. Real login/session state lives in features/auth/auth.ts as of
// Phase 10 (docs/FEATURE_AUDIT.md §8 item 9); this file previously also held
// a client-side-only "pick a name and role" simulated session with no
// backend behind it, now replaced by that real JWT-backed session.
export type OfficerRole = 'LAND_RECORD_OFFICER' | 'REGISTRATION_OFFICER' | 'PLANNING_OFFICER' | 'DISPUTE_OFFICER';

export const OFFICER_ROLES: OfficerRole[] = [
  'LAND_RECORD_OFFICER',
  'REGISTRATION_OFFICER',
  'PLANNING_OFFICER',
  'DISPUTE_OFFICER',
];

export const ROLE_LABELS: Record<OfficerRole, string> = {
  LAND_RECORD_OFFICER: 'Land Record Officer',
  REGISTRATION_OFFICER: 'Registration Officer',
  PLANNING_OFFICER: 'Planning Officer',
  DISPUTE_OFFICER: 'Dispute Officer',
};

// A role reviews exactly the workflow_steps row for its own department -
// mirrors the PIPELINES_BY_TYPE mapping in backend/src/workflows/workflows.service.ts.
export const ROLE_DEPARTMENT: Record<OfficerRole, string> = {
  LAND_RECORD_OFFICER: 'LAND_RECORDS',
  REGISTRATION_OFFICER: 'REGISTRATION',
  PLANNING_OFFICER: 'PLANNING',
  DISPUTE_OFFICER: 'DISPUTE',
};
