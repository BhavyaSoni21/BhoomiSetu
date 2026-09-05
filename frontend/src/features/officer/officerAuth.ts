import { useState } from 'react';

// Phase 7's "officer login" is a simulated role session, not real
// authentication - BHOOMISETU.md describes workflow stages as "controlled by
// a different simulated officer role". Real JWT/bcrypt/users-table auth and
// RBAC route middleware are Plan.md Phase 10 scope; this just lets the
// Officer Portal know who it's rendering for, persisted across reloads.
export type OfficerRole = 'LAND_RECORD_OFFICER' | 'REGISTRATION_OFFICER' | 'PLANNING_OFFICER';

export interface OfficerSession {
  name: string;
  role: OfficerRole;
}

export const OFFICER_ROLES: OfficerRole[] = ['LAND_RECORD_OFFICER', 'REGISTRATION_OFFICER', 'PLANNING_OFFICER'];

export const ROLE_LABELS: Record<OfficerRole, string> = {
  LAND_RECORD_OFFICER: 'Land Record Officer',
  REGISTRATION_OFFICER: 'Registration Officer',
  PLANNING_OFFICER: 'Planning Officer',
};

// A role reviews exactly the workflow_steps row for its own department -
// mirrors the PIPELINE mapping in backend/src/workflows/workflows.service.ts.
export const ROLE_DEPARTMENT: Record<OfficerRole, string> = {
  LAND_RECORD_OFFICER: 'LAND_RECORDS',
  REGISTRATION_OFFICER: 'REGISTRATION',
  PLANNING_OFFICER: 'PLANNING',
};

const STORAGE_KEY = 'bhoomisetu.officerSession';

export function getOfficerSession(): OfficerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!OFFICER_ROLES.includes(parsed.role)) return null;
    return parsed as OfficerSession;
  } catch {
    return null;
  }
}

function saveOfficerSession(session: OfficerSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures (private browsing, quota) - the session just
    // won't survive a reload, which is a graceful degradation here.
  }
}

function removeOfficerSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See saveOfficerSession.
  }
}

export function useOfficerSession() {
  const [session, setSession] = useState<OfficerSession | null>(() => getOfficerSession());

  const login = (next: OfficerSession) => {
    saveOfficerSession(next);
    setSession(next);
  };
  const logout = () => {
    removeOfficerSession();
    setSession(null);
  };

  return { session, login, logout };
}
