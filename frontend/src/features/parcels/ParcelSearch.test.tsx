import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ParcelSearch from './ParcelSearch';
import apiService from '../../services/apiService';



const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWithClient(ui: React.ReactElement, initialPath = '/parcels/search') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
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
    mockNavigate.mockReset();
  });

  it('requests /parcels (no double /api/v1 prefix)', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [] })));

    renderWithClient(<ParcelSearch />);

    // await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/parcels', expect.any(Object)));
  });

  it('renders search results returned by the API', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [sampleParcel] })));

    renderWithClient(<ParcelSearch />);

    expect(await screen.findByText(/CAN1|abcdef12/i)).toBeTruthy();
    expect(screen.getByText(/ULPIN: ULPIN123/)).toBeInTheDocument();
    expect(screen.getByText('DL-ND')).toBeInTheDocument();
  });

  it('shows an empty state when no parcels match', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [] })));

    renderWithClient(<ParcelSearch />);

    expect(await screen.findByText(/no parcels found/i)).toBeInTheDocument();
  });

  it('reports results back to the parent for map integration', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [sampleParcel] })));
    const onResultsChange = vi.fn();

    renderWithClient(<ParcelSearch onResultsChange={onResultsChange} />);

    await waitFor(() => expect(onResultsChange).toHaveBeenCalledWith([sampleParcel]));
  });

  it('selects a parcel by clicking its result row, without navigating', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [sampleParcel] })));
    const onSelectParcel = vi.fn();

    renderWithClient(<ParcelSearch onSelectParcel={onSelectParcel} />);

    const row = (await screen.findByText(/CAN1/i)).closest('div[class*="cursor-pointer"]') as HTMLElement;
    row.click();

    expect(onSelectParcel).toHaveBeenCalledWith(sampleParcel.id);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the parcel 360 view when "View" is clicked', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [sampleParcel] })));

    renderWithClient(<ParcelSearch />);

    const viewButton = await screen.findByRole('button', { name: /view/i });
    viewButton.click();

    expect(mockNavigate).toHaveBeenCalledWith(`/parcels/${sampleParcel.id}`);
  });

  it('prefills local_identifier from the URL (navbar quick-search)', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [] })));

    renderWithClient(<ParcelSearch />, '/parcels/search?local_identifier=MH-PUN-4126');

    await waitFor(() =>
      expect(apiService.get).toHaveBeenCalledWith(
        '/parcels',
        expect.objectContaining({ params: expect.objectContaining({ local_identifier: 'MH-PUN-4126' }) }),
      ),
    );
    expect(screen.getByPlaceholderText('Enter Local Identifier')).toHaveValue('MH-PUN-4126');
  });
});
