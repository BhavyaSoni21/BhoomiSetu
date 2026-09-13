import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TopRiskParcels from './TopRiskParcels';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWithRouter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TopRiskParcels />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleResponse = [
  { parcelId: 'p1-aaaaaaaa-bbbb', overallScore: 67, riskBand: 'HIGH', dataCompleteness: 0.6, factors: [] },
  { parcelId: 'p2-cccccccc-dddd', overallScore: 20, riskBand: 'LOW', dataCompleteness: 0.2, factors: [] },
];

describe('TopRiskParcels', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    mockNavigate.mockReset();
  });

  it('requests the top-risk-parcels endpoint with a limit', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: sampleResponse });
    renderWithRouter();

    await waitFor(() =>
      expect(apiService.get).toHaveBeenCalledWith('/predictive-analytics/top-risk-parcels', { params: { limit: 10 } }),
    );
  });

  it('renders each parcel with its risk band and score', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: sampleResponse });
    renderWithRouter();

    expect(await screen.findByText('HIGH (67)')).toBeInTheDocument();
    expect(screen.getByText('LOW (20)')).toBeInTheDocument();
  });

  it('navigates to the parcel 360 view when View is clicked', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: sampleResponse });
    renderWithRouter();

    const viewButtons = await screen.findAllByRole('button', { name: 'View' });
    fireEvent.click(viewButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/parcels/p1-aaaaaaaa-bbbb');
  });

  it('shows an empty-state message when there are no parcels to score', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderWithRouter();

    expect(await screen.findByText('No parcels to score yet.')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    vi.mocked(apiService.get).mockRejectedValue(new Error('network error'));
    renderWithRouter();

    expect(await screen.findByText('Error loading risk scores')).toBeInTheDocument();
  });
});
