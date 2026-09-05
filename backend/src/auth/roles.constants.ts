export const OFFICER_ROLES = ['LAND_RECORD_OFFICER', 'REGISTRATION_OFFICER', 'PLANNING_OFFICER', 'DISPUTE_OFFICER'] as const;
export const ALL_STAFF_ROLES = [...OFFICER_ROLES, 'ADMIN'] as const;

// Mirrors frontend/src/features/officer/officerAuth.ts's ROLE_DEPARTMENT -
// duplicated rather than shared, matching this codebase's existing
// convention of not sharing enum-like constants across the backend/frontend
// boundary (e.g. workflow types, dispute types are each declared twice too).
export const ROLE_DEPARTMENT: Record<string, string> = {
  LAND_RECORD_OFFICER: 'LAND_RECORDS',
  REGISTRATION_OFFICER: 'REGISTRATION',
  PLANNING_OFFICER: 'PLANNING',
  DISPUTE_OFFICER: 'DISPUTE',
};
