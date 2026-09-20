import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RequireAuth from './RequireAuth';
import { AuthUser } from './auth';

const officer: AuthUser = { id: 'u1', email: 'officer@test.gov.in', name: 'Asha', role: 'LAND_RECORD_OFFICER' };
const admin: AuthUser = { id: 'u2', email: 'admin@test.gov.in', name: 'Admin', role: 'ADMIN' };

function renderGuarded(user: AuthUser | null | undefined, roles: AuthUser['role'][]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (user !== undefined) client.setQueryData(['auth-me'], user);
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/officer']}>
        <Routes>
          <Route
            path="/officer"
            element={
              <RequireAuth roles={roles}>
                <div>Protected Content</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => localStorage.clear());

  it('renders the protected content when the user has an allowed role', () => {
    renderGuarded(officer, ['LAND_RECORD_OFFICER', 'PLANNING_OFFICER']);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    renderGuarded(null, ['LAND_RECORD_OFFICER']);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it("redirects to /login when the user's role is not in the allowed list", () => {
    renderGuarded(officer, ['ADMIN']);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('allows an admin through an admin-only guard', () => {
    renderGuarded(admin, ['ADMIN']);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
