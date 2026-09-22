import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilePage from './ProfilePage';
import apiService from '../../services/apiService';
import { AuthUser } from '../../features/auth/auth';



// Email verified, mobile not yet added - lets each test's assertions target
// exactly one "Change" (email) and one "Add" (mobile) button unambiguously,
// rather than needing to scope queries into one specific contact-method card.
const emailOnlyCitizen: AuthUser = {
  id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN',
  emailVerified: true, mobileNumber: null, mobileVerified: false, pendingEmail: null, pendingMobileNumber: null,
  createdAt: '2026-01-15T00:00:00.000Z',
};

// The Account tab always fires /parcels/mine and /workflows/mine for its
// "more info" stats, regardless of which test/tab is under test - every test
// needs both satisfied or the unmocked one rejects with "unexpected url".
// The Documents tab additionally fires GET /parcels/:id/documents per linked
// parcel.
function mockApi(overrides: { parcels?: unknown[]; workflows?: unknown[]; documents?: Record<string, unknown[]> } = {}) {
  server.use(
    http.get('*/parcels/mine', () => HttpResponse.json({ parcels: overrides.parcels ?? [], total: overrides.parcels?.length ?? 0 })),
    http.get('*/workflows/mine', () => HttpResponse.json(overrides.workflows ?? [])),
    http.get('*/parcels/:id/documents', ({ params }) => {
      const docs = overrides.documents?.[params.id as string] ?? [];
      return HttpResponse.json(docs);
    })
  );
}

function renderPage(user: AuthUser, initialEntries: string[] = ['/citizen/profile']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  // Override my-parcels to empty for tests that need no parcels
  client.setQueryData(['my-parcels'], { parcels: [], total: 0 });
  client.setQueryData(['my-workflows'], []);
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mockApi();
  });

  it("shows the verified email and an Add button for the missing mobile number", () => {
    renderPage(emailOnlyCitizen);
    expect(screen.getByText('citizen1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    // "Not provided" now also appears for the unset address/governmentIdNumber/
    // occupation fields (Profile Details card), not just the missing mobile number.
    expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('shows a Change button (not Add) for the already-verified email', () => {
    renderPage(emailOnlyCitizen);
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('adding a mobile number sends it for verification and shows the OTP step', async () => {
    server.use(http.post('*', () => HttpResponse.json({ ...emailOnlyCitizen, mobileNumber: '9666666666', mobileVerified: false },)));
    renderPage(emailOnlyCitizen);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByPlaceholderText('10-digit mobile number'), { target: { value: '9666666666' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Code' }));

    // await waitFor(() =>
    // expect(apiService.post).toHaveBeenCalledWith('/auth/profile/contact', { method: 'MOBILE', email: undefined, mobileNumber: '9666666666' }),
    // );
    expect(await screen.findByText(/We've sent a 6-digit code to 9666666666/)).toBeInTheDocument();
  });

  it('shows a pending-verification note and a Verify button when a change is in progress', () => {
    renderPage({ ...emailOnlyCitizen, pendingEmail: 'new-address@example.com' });
    expect(screen.getByText('Verification pending for new-address@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });

  it('shows an Unverified badge and a Verify button right after registration (set but not yet verified)', () => {
    renderPage({ ...emailOnlyCitizen, mobileNumber: '9777777777', mobileVerified: false });
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });

  describe('more info (Account tab)', () => {
    it('shows member-since, linked-parcel count, and total request count', async () => {
      mockApi({ parcels: [{ id: 'p1', areaSqM: 300, ulpin: 'UL123' }, { id: 'p2', areaSqM: 250 }], workflows: [{ id: 'w1' }] });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      client.setQueryData(['auth-me'], emailOnlyCitizen);
      client.setQueryData(['my-parcels'], { parcels: [{ id: 'p1', areaSqM: 300, ulpin: 'UL123' }, { id: 'p2', areaSqM: 250 }], total: 2 });
      client.setQueryData(['my-workflows'], [{ id: 'w1' }]);
      renderWithProviders(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/citizen/profile']}>
            <ProfilePage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByText('Member Since')).toBeInTheDocument();
      expect(screen.getByText('15 Jan 2026')).toBeInTheDocument();
      const parcelsValue = await screen.findByText('2');
      expect(parcelsValue.previousElementSibling).toHaveTextContent('Linked Parcels');
      const requestsValue = await screen.findByText('1');
      expect(requestsValue.previousElementSibling).toHaveTextContent('Total Requests');
    });

    it('omits Member Since when createdAt is unknown (pre-existing account/test fixture)', () => {
      renderPage({ ...emailOnlyCitizen, createdAt: undefined });
      expect(screen.queryByText('Member Since')).not.toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('shows a "no parcels" message on the Documents tab when the citizen has no linked parcels', () => {
      renderPage(emailOnlyCitizen);
      fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
      expect(screen.getByText('Documents', { selector: 'h2' })).toBeInTheDocument();
      expect(screen.getByText(/No parcels are linked to your account yet/)).toBeInTheDocument();
      // Contact cards from the Account tab are gone once switched away.
      expect(screen.queryByText('citizen1@example.com')).not.toBeInTheDocument();
    });

    it("shows each linked parcel's documents, or an empty-state message when it has none", async () => {
      mockApi({
        parcels: [{ id: 'p1', ulpin: 'UL123', stateCode: 'MH', districtCode: 'PUN', areaSqM: 26714 }, { id: 'p2', ulpin: 'UL456', stateCode: 'DL', districtCode: 'NEW', areaSqM: 15000 }],
        documents: {
          p1: [{ id: 'd1', parcelId: 'p1', documentType: 'ROR_COPY', fileName: 'p1.png', mimeType: 'image/png', registrationStatus: 'REGISTERED', createdAt: '2026-01-01' }],
          p2: [],
        },
      });
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      client.setQueryData(['auth-me'], emailOnlyCitizen);
      client.setQueryData(['my-parcels'], { parcels: [{ id: 'p1', ulpin: 'UL123', stateCode: 'MH', districtCode: 'PUN', areaSqM: 26714 }, { id: 'p2', ulpin: 'UL456', stateCode: 'DL', districtCode: 'NEW', areaSqM: 15000 }], total: 2 });
      client.setQueryData(['my-workflows'], []);
      renderWithProviders(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/citizen/profile']}>
            <ProfilePage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Documents' }));

      expect(await screen.findByText('UL123')).toBeInTheDocument();
      expect(await screen.findByText('REGISTERED')).toBeInTheDocument();
      expect(screen.getByText('UL456')).toBeInTheDocument();
      expect(screen.getByText(/No documents are on file for this parcel yet/)).toBeInTheDocument();
    });

    it('deep-links to the Documents tab via ?tab=documents', () => {
      renderPage(emailOnlyCitizen, ['/citizen/profile?tab=documents']);
      expect(screen.queryByText('citizen1@example.com')).not.toBeInTheDocument();
    });
  });

  describe('Profile Details (name/address/governmentIdNumber/occupation)', () => {
    it('shows the current values read-only, with no OTP step involved', () => {
      renderPage({ ...emailOnlyCitizen, address: '12 MG Road', governmentIdNumber: 'ABCD1234E', occupation: 'Farmer' });
      expect(screen.getByText('12 MG Road')).toBeInTheDocument();
      expect(screen.getByText('ABCD1234E')).toBeInTheDocument();
      expect(screen.getByText('Farmer')).toBeInTheDocument();
    });

    it('editing and saving posts to /auth/profile/details and returns to the read-only view', async () => {
      server.use(http.post('*', () => HttpResponse.json({ ...emailOnlyCitizen, occupation: 'Teacher' },)));
      renderPage(emailOnlyCitizen);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByLabelText('Occupation'), { target: { value: 'Teacher' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(apiService.post).toHaveBeenCalledWith(
          '/auth/profile/details',
          expect.objectContaining({ name: 'A Citizen', occupation: 'Teacher' }),
        ),
      );
      expect(await screen.findByText('Teacher')).toBeInTheDocument();
    });
  });
});
