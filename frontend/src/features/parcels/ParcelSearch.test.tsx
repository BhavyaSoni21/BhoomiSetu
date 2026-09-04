import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ParcelSearch from './ParcelSearch';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const sampleParcel = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  canonicalParcelId: 'CAN1',
  ulpin: 'ULPIN123',
  stateCode: 'DL',
  districtCode: 'ND',
  localBodyCode: 'DLLB1',
  areaSqM: 250,
  geometry: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}',
};

describe('ParcelSearch', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    mockNavigate.mockReset();
  });

  it('requests /parcels (no double /api/v1 prefix)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [] } });

    renderWithClient(<ParcelSearch />);

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/parcels', expect.any(Object)));
  });

  it('renders search results returned by the API', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [sampleParcel] } });

    renderWithClient(<ParcelSearch />);

    expect(await screen.findByText(/CAN1|abcdef12/i)).toBeTruthy();
    expect(screen.getByText(/ULPIN: ULPIN123/)).toBeInTheDocument();
    expect(screen.getByText('DL-ND')).toBeInTheDocument();
  });

  it('shows an empty state when no parcels match', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [] } });

    renderWithClient(<ParcelSearch />);

    expect(await screen.findByText(/no parcels found/i)).toBeInTheDocument();
  });

  it('reports results back to the parent for map integration', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [sampleParcel] } });
    const onResultsChange = vi.fn();

    renderWithClient(<ParcelSearch onResultsChange={onResultsChange} />);

    await waitFor(() => expect(onResultsChange).toHaveBeenCalledWith([sampleParcel]));
  });

  it('selects a parcel by clicking its result row, without navigating', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [sampleParcel] } });
    const onSelectParcel = vi.fn();

    renderWithClient(<ParcelSearch onSelectParcel={onSelectParcel} />);

    const row = (await screen.findByText(/abcdef12/i)).closest('div[class*="cursor-pointer"]') as HTMLElement;
    row.click();

    expect(onSelectParcel).toHaveBeenCalledWith(sampleParcel.id);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the parcel 360 view when "View" is clicked', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [sampleParcel] } });

    renderWithClient(<ParcelSearch />);

    const viewButton = await screen.findByRole('button', { name: /view/i });
    viewButton.click();

    expect(mockNavigate).toHaveBeenCalledWith(`/parcels/${sampleParcel.id}`);
  });
});
