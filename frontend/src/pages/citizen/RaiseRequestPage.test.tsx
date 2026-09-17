import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RaiseRequestPage from './RaiseRequestPage';
import apiService from '../../services/apiService';
import { AuthUser } from '../../features/auth/auth';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const citizen: AuthUser = { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' };

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

const parcelOne = {
  id: 'p1',
  canonicalParcelId: 'CAN-1',
  localId: 'MH-AH-SH-101/1',
  ulpin: 'ULPIN-1',
  stateCode: 'MH',
  districtCode: 'AH',
  localBodyCode: 'SH',
  areaSqM: 500,
  geometry: '{}',
  status: 'Registered',
};
const parcelTwo = {
  id: 'p2',
  canonicalParcelId: 'CAN-2',
  localId: 'MH-AH-SH-102/2',
  ulpin: null,
  stateCode: 'MH',
  districtCode: 'AH',
  localBodyCode: 'SH',
  areaSqM: 300,
  geometry: '{}',
  status: 'Registered',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], citizen);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
          <LocationProbe />
        <RaiseRequestPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RaiseRequestPage', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.post).mockReset();
  });

  it('shows a no-parcels message and Link Parcel CTA when citizen has no registered parcels', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [], total: 0 } });
    renderPage();

    expect(await screen.findByText(/No registered parcels on your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Link a Parcel to Get Started/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Select Verified Parcel/i)).not.toBeInTheDocument();
    expect(await screen.findByTestId('location')).toHaveTextContent('/citizen/parcels?from=raise-request');
  });

  it('blocks parcels with status Pending Verification from complaint selection', async () => {
    const pendingParcel = {
      id: 'p-pending',
      canonicalParcelId: 'CAN-P',
      localId: 'MH-AH-SH-999',
      ulpin: null,
      stateCode: 'MH',
      districtCode: 'AH',
      localBodyCode: 'SH',
      areaSqM: 400,
      geometry: '{}',
      status: 'Pending Verification',
    };
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [pendingParcel], total: 1 } });
    renderPage();

    expect(await screen.findByText(/No registered parcels on your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/currently under officer review/i)).toBeInTheDocument();
  });

  it("lists only the citizen's registered parcels in the dropdown", async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [parcelOne, parcelTwo], total: 2 } });
    renderPage();

    const select = await screen.findByLabelText(/Select Verified Parcel/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /MH-AH-SH-101\/1/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /MH-AH-SH-102\/2/i })).toBeInTheDocument();
  });

  it('selecting a parcel reveals the service actions and shows parcel summary', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [parcelOne, parcelTwo], total: 2 } });
    renderPage();

    const select = await screen.findByLabelText(/Select Verified Parcel/i);
    fireEvent.change(select, { target: { value: 'p1' } });

    expect(screen.getAllByText(/MH-AH-SH-101\/1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Verified Holding/i)).toBeInTheDocument();
    expect(screen.getAllByText(/500/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Certified RoR \/ 7\/12 Extract/i)).toBeInTheDocument();
  });
});
