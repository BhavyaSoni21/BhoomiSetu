import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import * as authHooks from './auth';

// Regression: a valid session must survive a slow/cold backend. When a token is
// present but /auth/me hasn't answered yet (undefined), RequireAuth must show
// "reconnecting" and NOT redirect to /login (the "Google login not retained on
// refresh" bug). It only redirects once we KNOW there's no user (null).
vi.mock('../../context/LanguageContext', () => ({
  useTranslation: () => ({ t: (_k: string, fb?: string) => fb ?? _k }),
}));

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/citizen']}>
      <Routes>
        <Route path="/citizen" element={<RequireAuth roles={['CITIZEN']}><div>secret</div></RequireAuth>} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth cold-backend tolerance', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('shows reconnecting (no redirect) when a token exists but /auth/me is still failing', () => {
    localStorage.setItem('access_token', 'real-token');
    vi.spyOn(authHooks, 'useAuthUser').mockReturnValue({ data: undefined, isLoading: false, isError: true } as ReturnType<typeof authHooks.useAuthUser>);
    renderGuarded();
    expect(screen.getByText('Reconnecting to server…')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });

  it('redirects to /login once we know there is no user', () => {
    vi.spyOn(authHooks, 'useAuthUser').mockReturnValue({ data: null, isLoading: false, isError: false } as ReturnType<typeof authHooks.useAuthUser>);
    renderGuarded();
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders the guarded content for a matching signed-in user', () => {
    vi.spyOn(authHooks, 'useAuthUser').mockReturnValue({ data: { role: 'CITIZEN' }, isLoading: false, isError: false } as ReturnType<typeof authHooks.useAuthUser>);
    renderGuarded();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
