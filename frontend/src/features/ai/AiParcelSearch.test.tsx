import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AiParcelSearch from './AiParcelSearch';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { post: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWithRouter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AiParcelSearch />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleResponse = {
  filters: { tax_status: 'OVERDUE', has_restriction: true },
  totalMatches: 2,
  results: [
    { id: 'p1', canonicalParcelId: 'CAN1', ulpin: null, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB1', areaSqM: 100, geometry: '{}' },
    { id: 'p2', canonicalParcelId: 'CAN2', ulpin: null, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB1', areaSqM: 200, geometry: '{}' },
  ],
};

describe('AiParcelSearch', () => {
  beforeEach(() => {
    vi.mocked(apiService.post).mockReset();
    mockNavigate.mockReset();
  });

  it('does not submit an empty query', () => {
    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('submits the query and shows interpreted filters plus results', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: sampleResponse });
    renderWithRouter();

    fireEvent.change(screen.getByPlaceholderText(/Show me parcels/), {
      target: { value: 'parcels with overdue tax and a restriction' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/ai/query', { query: 'parcels with overdue tax and a restriction' }),
    );
    expect(await screen.findByText('2 parcel(s) matched')).toBeInTheDocument();
    expect(screen.getByText(/Tax Status = OVERDUE/)).toBeInTheDocument();
    expect(screen.getByText(/Has Restriction = true/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2);
  });

  it('navigates to the parcel 360 view when View is clicked', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: sampleResponse });
    renderWithRouter();

    fireEvent.change(screen.getByPlaceholderText(/Show me parcels/), { target: { value: 'anything' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    const viewButtons = await screen.findAllByRole('button', { name: 'View' });
    fireEvent.click(viewButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/parcels/p1');
  });

  it('shows a specific message for a 503 (AI not configured)', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 503 } });
    renderWithRouter();

    fireEvent.change(screen.getByPlaceholderText(/Show me parcels/), { target: { value: 'anything' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    expect(await screen.findByText('AI is not configured on this server.')).toBeInTheDocument();
  });

  it('shows a generic message for other errors', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 502 } });
    renderWithRouter();

    fireEvent.change(screen.getByPlaceholderText(/Show me parcels/), { target: { value: 'anything' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    expect(await screen.findByText(/Something went wrong interpreting that query/)).toBeInTheDocument();
  });
});
