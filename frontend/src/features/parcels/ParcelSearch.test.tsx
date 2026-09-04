import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ParcelSearch from './ParcelSearch';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ParcelSearch', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
  });

  it('requests /parcels (no double /api/v1 prefix)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [] } });

    renderWithClient(<ParcelSearch />);

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/parcels', expect.any(Object)));
  });

  it('renders search results returned by the API', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: {
        parcels: [
          {
            id: 'abcdef12-0000-0000-0000-000000000000',
            canonicalParcelId: 'CAN1',
            ulpin: 'ULPIN123',
            stateCode: 'DL',
            districtCode: 'ND',
            localBodyCode: 'DLLB1',
            areaSqM: 250,
          },
        ],
      },
    });

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
});
