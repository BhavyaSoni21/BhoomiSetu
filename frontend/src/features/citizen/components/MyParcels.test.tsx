import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyParcels from './MyParcels';
import apiService from '../../../services/apiService';
import { AuthUser } from '../../auth/auth';

vi.mock('../../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

const citizen: AuthUser = { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' };
const officer: AuthUser = { id: 'o1', email: 'officer@test.gov.in', name: 'An Officer', role: 'LAND_RECORD_OFFICER' };

function renderPanel(user: AuthUser | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MyParcels />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('MyParcels', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
  });

  it('prompts to sign in when not authenticated, and never calls /parcels/mine', async () => {
    renderPanel(null);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it('prompts to sign in for a non-citizen (e.g. an officer viewing the citizen portal), without calling /parcels/mine', async () => {
    renderPanel(officer);
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it('shows a friendly empty state for a citizen with no linked parcels', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [], total: 0 } });
    renderPanel(citizen);

    expect(await screen.findByText(/No parcels are linked to your account yet/)).toBeInTheDocument();
    expect(apiService.get).toHaveBeenCalledWith('/parcels/mine');
  });

  it("lists a citizen's linked parcels", async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: {
        total: 2,
        parcels: [
          { id: 'p1234567-aaaa', canonicalParcelId: 'CAN10000', ulpin: 'ULPIN0001', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB1', areaSqM: 5000, geometry: '{}' },
          { id: 'p2234567-bbbb', canonicalParcelId: 'CAN10001', ulpin: null, stateCode: 'TN', districtCode: 'CHE', localBodyCode: 'TNLB1', areaSqM: 3200, geometry: '{}' },
        ],
      },
    });
    renderPanel(citizen);

    expect(await screen.findByText(/2 parcels linked to your account/)).toBeInTheDocument();
    expect(screen.getByText('ULPIN: ULPIN0001')).toBeInTheDocument();
    expect(screen.getByText('No ULPIN')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2);
  });

  it('signing out clears the session and reverts to the sign-in prompt', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [], total: 0 } });
    renderPanel(citizen);

    await screen.findByText(/No parcels are linked/);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument());
  });
});
