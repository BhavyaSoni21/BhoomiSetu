import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OfficerProfilePage from './OfficerProfilePage';
import apiService from '../../services/apiService';
import { AuthUser } from '../../features/auth/auth';



const officer: AuthUser = {
  id: 'o1', email: 'land.officer@bhoomisetu.gov.in', name: 'Officer Rao', role: 'LAND_RECORD_OFFICER',
  emailVerified: true, mobileNumber: null, mobileVerified: false, pendingEmail: null, pendingMobileNumber: null,
  createdAt: '2026-01-15T00:00:00.000Z',
};

function renderPage(user: AuthUser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OfficerProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OfficerProfilePage', () => {
  beforeEach(() => {
  });

  it("shows the officer's name, role, department, and member-since", () => {
    renderPage(officer);
    expect(screen.getAllByText('Officer Rao').length).toBeGreaterThan(0);
    expect(screen.getByText('Land Record Officer')).toBeInTheDocument();
    expect(screen.getByText('LAND RECORDS')).toBeInTheDocument();
    expect(screen.getByText('15 Jan 2026')).toBeInTheDocument();
  });

  it('omits Member Since when createdAt is unknown (pre-existing account/test fixture)', () => {
    renderPage({ ...officer, createdAt: undefined });
    expect(screen.queryByText('Member Since')).not.toBeInTheDocument();
  });

  it('shows the verified email and an Add button for the missing mobile number', () => {
    renderPage(officer);
    expect(screen.getByText('land.officer@bhoomisetu.gov.in')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('adding a mobile number sends it for verification and shows the OTP step', async () => {
    server.use(http.post('*', () => HttpResponse.json({ ...officer, mobileNumber: '9666666666', mobileVerified: false },)));
    renderPage(officer);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByPlaceholderText('10-digit mobile number'), { target: { value: '9666666666' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Code' }));

    // await waitFor(() =>
    // expect(apiService.post).toHaveBeenCalledWith('/auth/profile/contact', { method: 'MOBILE', email: undefined, mobileNumber: '9666666666' }),
    // );
    expect(await screen.findByText(/We've sent a 6-digit code to 9666666666/)).toBeInTheDocument();
  });

  describe('Profile Details (name/address/governmentIdNumber/occupation)', () => {
    it('shows the current values read-only, with no OTP step involved', () => {
      renderPage({ ...officer, address: '12 MG Road', governmentIdNumber: 'ABCD1234E', occupation: 'Government Officer' });
      expect(screen.getByText('12 MG Road')).toBeInTheDocument();
      expect(screen.getByText('ABCD1234E')).toBeInTheDocument();
      expect(screen.getByText('Government Officer')).toBeInTheDocument();
    });

    it('editing and saving posts to /auth/profile/details and returns to the read-only view', async () => {
      server.use(http.post('*', () => HttpResponse.json({ ...officer, occupation: 'Senior Land Record Officer' },)));
      renderPage(officer);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByLabelText('Occupation'), { target: { value: 'Senior Land Record Officer' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(apiService.post).toHaveBeenCalledWith(
          '/auth/profile/details',
          expect.objectContaining({ name: 'Officer Rao', occupation: 'Senior Land Record Officer' }),
        ),
      );
      expect(await screen.findByText('Senior Land Record Officer')).toBeInTheDocument();
    });
  });
});
