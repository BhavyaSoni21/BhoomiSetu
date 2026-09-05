import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getOfficerSession, useOfficerSession } from './officerAuth';

describe('officerAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getOfficerSession returns null when nothing is stored', () => {
    expect(getOfficerSession()).toBeNull();
  });

  it('getOfficerSession returns null for a corrupted/invalid stored value', () => {
    localStorage.setItem('bhoomisetu.officerSession', 'not json');
    expect(getOfficerSession()).toBeNull();

    localStorage.setItem('bhoomisetu.officerSession', JSON.stringify({ name: 'X', role: 'NOT_A_REAL_ROLE' }));
    expect(getOfficerSession()).toBeNull();
  });

  it('useOfficerSession login persists to localStorage and updates state', () => {
    const { result } = renderHook(() => useOfficerSession());
    expect(result.current.session).toBeNull();

    act(() => result.current.login({ name: 'Asha', role: 'LAND_RECORD_OFFICER' }));

    expect(result.current.session).toEqual({ name: 'Asha', role: 'LAND_RECORD_OFFICER' });
    expect(getOfficerSession()).toEqual({ name: 'Asha', role: 'LAND_RECORD_OFFICER' });
  });

  it('useOfficerSession logout clears localStorage and state', () => {
    const { result } = renderHook(() => useOfficerSession());
    act(() => result.current.login({ name: 'Asha', role: 'PLANNING_OFFICER' }));
    act(() => result.current.logout());

    expect(result.current.session).toBeNull();
    expect(getOfficerSession()).toBeNull();
  });

  it('a fresh hook instance picks up a previously-stored session', () => {
    localStorage.setItem('bhoomisetu.officerSession', JSON.stringify({ name: 'Ravi', role: 'REGISTRATION_OFFICER' }));
    const { result } = renderHook(() => useOfficerSession());
    expect(result.current.session).toEqual({ name: 'Ravi', role: 'REGISTRATION_OFFICER' });
  });
});
