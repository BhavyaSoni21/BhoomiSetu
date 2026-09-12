export const OFFICER_ROLES = [
  'LAND_RECORD_OFFICER',
  'REGISTRATION_OFFICER',
  'PLANNING_OFFICER',
  'DISPUTE_OFFICER',
  'TAX_OFFICER',
  'RESTRICTION_OFFICER',
  'ENCUMBRANCE_OFFICER',
] as const;
export const ALL_STAFF_ROLES = [...OFFICER_ROLES, 'ADMIN'] as const;

// Optional citizen sign-in (docs/Plan.md Phase 12): a citizen account exists
// purely to associate a login with 0-5 parcels for a "My Parcels" dashboard -
// citizens never appear in ALL_STAFF_ROLES/the Admin Portal's user
// management, and Citizen Portal search/service-requests remain anonymous
// and usable with no account at all.
export const CITIZEN_ROLE = 'CITIZEN';

// Mirrors frontend/src/features/officer/officerAuth.ts's ROLE_DEPARTMENT -
// duplicated rather than shared, matching this codebase's existing
// convention of not sharing enum-like constants across the backend/frontend
// boundary (e.g. workflow types, dispute types are each declared twice too).
export const ROLE_DEPARTMENT: Record<string, string> = {
  LAND_RECORD_OFFICER: 'LAND_RECORDS',
  REGISTRATION_OFFICER: 'REGISTRATION',
  PLANNING_OFFICER: 'PLANNING',
  DISPUTE_OFFICER: 'DISPUTE',
  TAX_OFFICER: 'TAX',
  RESTRICTION_OFFICER: 'RESTRICTION',
  ENCUMBRANCE_OFFICER: 'ENCUMBRANCE',
};

// Reverse of the map above (department code -> officer role) - used by
// RequestRoutingService to turn an AI-chosen department code into a real
// {department, assignedRole} pipeline step, and by the governance-alert
// review flow to find which officer role to notify for a given alert.
export const DEPARTMENT_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_DEPARTMENT).map(([role, department]) => [department, role]),
);
