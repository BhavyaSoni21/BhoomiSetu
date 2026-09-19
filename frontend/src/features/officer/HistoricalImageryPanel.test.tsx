import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HistoricalImageryPanel from './HistoricalImageryPanel';
import apiService from '../../services/apiService';

import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';

// UnifiedMapWrapper needs hierarchical clusters for its dropdown and a
// satellite-image endpoint for the officer-only satellite view mode.
// Stub it with a component that exposes the props HistoricalMapView computes
// (parcels/parcelColors/parcelLabels/selectedYear) so tests can assert the
// map wiring without a real map, matching Parcel360View.test.tsx's pattern.
vi.mock('../map/UnifiedMapWrapper', () => ({
  default: (props: {
    parcels: { id: string }[];
    parcelColors?: Record<string, string>;
    parcelLabels?: Record<string, string>;
    selectedYear?: number;
    historicalYears?: number[];
    onYearChange?: (year: number) => void;
    showYearSelector?: boolean;
  }) => (
    <div data-testid="mock-unified-map">
      <span data-testid="map-parcel-count">{props.parcels.length}</span>
      <span data-testid="map-colors">{JSON.stringify(props.parcelColors)}</span>
      <span data-testid="map-labels">{JSON.stringify(props.parcelLabels)}</span>
      <span data-testid="map-selected-year">{props.selectedYear ?? props.historicalYears?.[props.historicalYears.length - 1] ?? ''}</span>
      {props.showYearSelector && props.historicalYears && (
        <select
          data-testid="map-year-select"
          value={props.selectedYear ?? props.historicalYears[props.historicalYears.length - 1]}
          onChange={(e) => props.onYearChange?.(Number(e.target.value))}
        >
          {props.historicalYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
    </div>
  ),
}));

// HistoricalYearCompare's compare mutation needs the compare endpoint
// HistoricalMapView's satellite view needs the satellite-image endpoint
const clusters = [{ clusterId: 'MH-PUNE-01', years: [2022, 2023, 2024, 2025] }];
const categorizedParcels2025 = [
  { id: 'p1', canonicalParcelId: 'MH-PUN-0001', ulpin: null, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: '{}', category: 'DISPUTE_OWNERSHIP' },
  { id: 'p2', canonicalParcelId: 'MH-PUN-0002', ulpin: null, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 600, geometry: '{}', category: 'NONE' },
];

function setApiMock(overrides: Record<string, unknown> = {}) {
  server.use(
    http.get('*/historical-imagery/clusters', () => {
      if (overrides['/historical-imagery/clusters']) return HttpResponse.json(overrides['/historical-imagery/clusters']);
      return HttpResponse.json(clusters);
    }),
    http.get('*/historical-imagery/clusters/MH-PUNE-01/years/:year/parcels', ({ params }) => {
      if (overrides[`/historical-imagery/clusters/MH-PUNE-01/years/${params.year}/parcels`]) {
        return HttpResponse.json(overrides[`/historical-imagery/clusters/MH-PUNE-01/years/${params.year}/parcels`]);
      }
      if (params.year === '2025') return HttpResponse.json(categorizedParcels2025);
      return HttpResponse.json([]);
    }),
    http.get('*/gis/clusters-hierarchical', () => HttpResponse.json([{ stateCode: 'MH', districts: [{ districtCode: 'PUN', clusters: [{ clusterId: 'MH-PUNE-01', bounds: { minLng: 0, minLat: 0, maxLng: 1, maxLat: 1 } }] }] }])),
    http.get('*/satellite-image*', () => new HttpResponse(new Blob(['fake'], { type: 'image/png' }))),
    http.post('*/historical-imagery/clusters/MH-PUNE-01/compare', () => HttpResponse.json({ clusterId: 'MH-PUNE-01', fromYear: 2024, toYear: 2025, changeDetected: false, affectedParcels: [] })),
    http.get('*/parcels', () => HttpResponse.json([]))
  );
}

function renderWithClient(ui: React.ReactElement, queryOverrides: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // Prime common query cache
  client.setQueryData(['historical-imagery', ''], { images: [] });
  client.setQueryData(['change-detection', ''], { changes: [] });
  Object.entries(queryOverrides).forEach(([key, data]) => client.setQueryData(JSON.parse(key), data));
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/officer/historical-imagery']}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HistoricalImageryPanel', () => {
  beforeEach(() => {
            // Default implementation for all endpoints
    setApiMock();
    
  });

  it('shows an empty state when no clusters have imagery yet', async () => {
    setApiMock({
      '/historical-imagery/clusters': { data: [] },
    });
    renderWithClient(<HistoricalImageryPanel />);

    expect(await screen.findByText('No historical imagery has been generated yet.')).toBeInTheDocument();
  });

  it('loads the cluster list and compares the two most recent years only - no picker', async () => {
    renderWithClient(<HistoricalImageryPanel />);

    // API call to '/historical-imagery/clusters' is implicitly tested by UI state
    expect(await screen.findByRole('option', { name: 'MH-PUNE-01' })).toBeInTheDocument();

    expect(await screen.findByText('Comparing 2024 to 2025 - the only pair that can generate governance alerts.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'From year' })).not.toBeInTheDocument();
  });

  it('defaults the map year to the newest year, fetches real categorized parcels for it, and colors the map by category', async () => {
    renderWithClient(<HistoricalImageryPanel />);

    // UnifiedMapWrapper year selector uses translation key for label
    const yearSelect = await screen.findByTestId('map-year-select');
    expect(yearSelect).toHaveValue('2025');
    await waitFor(() =>
      expect(apiService.get).toHaveBeenCalledWith('/historical-imagery/clusters/MH-PUNE-01/years/2025/parcels'),
    );
    expect(await screen.findByTestId('map-parcel-count')).toHaveTextContent('2');
    const colors = JSON.parse(screen.getByTestId('map-colors').textContent!);
    expect(colors.p1).toBe('#6b4c9a'); // DISPUTE_OWNERSHIP
    expect(colors.p2).toBe('#8fae86'); // NONE
    const labels = JSON.parse(screen.getByTestId('map-labels').textContent!);
    expect(labels.p1).toBe('Ownership dispute');
  });

  it('changing the map year dropdown fetches that year\'s parcels', async () => {
    renderWithClient(<HistoricalImageryPanel />);

    const yearSelect = await screen.findByTestId('map-year-select');
    fireEvent.change(yearSelect, { target: { value: '2023' } });

    await waitFor(() =>
      expect(apiService.get).toHaveBeenCalledWith('/historical-imagery/clusters/MH-PUNE-01/years/2023/parcels'),
    );
  });

  it('running a comparison posts the two most recent years and shows each affected parcel with its category change, narrative, and alert badge', async () => {
    server.use(http.post('*/compare', () => HttpResponse.json({
        clusterId: 'MH-PUNE-01', fromYear: 2024, toYear: 2025, changeDetected: true,
        affectedParcels: [
          {
            parcelId: 'p1', canonicalParcelId: 'MH-PUN-0001', fromCategory: 'NONE', toCategory: 'DISPUTE_OWNERSHIP',
            narrative: 'This parcel has an active ownership dispute filed in 2025.', alertId: 'alert-1',
          },
          {
            parcelId: 'p2', canonicalParcelId: 'MH-PUN-0002', fromCategory: 'RESTRICTED', toCategory: 'NONE',
            narrative: 'The restriction previously on this parcel is no longer active.', alertId: null,
          },
        ],
      })))
    renderWithClient(<HistoricalImageryPanel />);

    await screen.findByRole('option', { name: 'MH-PUNE-01' });
    fireEvent.click(screen.getByRole('button', { name: /Compare Years/ }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith(
        '/historical-imagery/clusters/MH-PUNE-01/compare',
        { fromYear: 2024, toYear: 2025 },
        { timeout: 60000 },
      ),
    );
    expect(await screen.findByText('2 parcels changed status between 2024 and 2025.')).toBeInTheDocument();

    expect(screen.getByText('MH-PUN-0001')).toBeInTheDocument();
    expect(screen.getByText('This parcel has an active ownership dispute filed in 2025.')).toBeInTheDocument();
    expect(screen.getAllByText('Alert raised')).toHaveLength(1);

    expect(screen.getByText('MH-PUN-0002')).toBeInTheDocument();
    expect(screen.getByText('The restriction previously on this parcel is no longer active.')).toBeInTheDocument();
  });

  it('running a comparison with no changes shows the no-change state and no parcel rows', async () => {
    server.use(http.post('*/compare', () => HttpResponse.json({ clusterId: 'MH-PUNE-01', fromYear: 2024, toYear: 2025, changeDetected: false, affectedParcels: [] })))
    renderWithClient(<HistoricalImageryPanel />);

    await screen.findByRole('option', { name: 'MH-PUNE-01' });
    fireEvent.click(screen.getByRole('button', { name: /Compare Years/ }));

    expect(await screen.findByText("No parcel's status changed between 2024 and 2025.")).toBeInTheDocument();
  });

  it('shows an error message when the comparison request fails', async () => {
    server.use(http.post('*/compare', () => HttpResponse.error()))
    renderWithClient(<HistoricalImageryPanel />);

    await screen.findByRole('option', { name: 'MH-PUNE-01' });
    fireEvent.click(screen.getByRole('button', { name: /Compare Years/ }));

    expect(await screen.findByText('Could not run the comparison. Please try again.')).toBeInTheDocument();
  });

  it('preselects the cluster passed via initialClusterId', async () => {
    setApiMock({
      '/historical-imagery/clusters': { data: [{ clusterId: 'MH-PUNE-01', years: [2022, 2023] }, { clusterId: 'MH-PUNE-02', years: [2024, 2025] }] },
      '/historical-imagery/clusters/MH-PUNE-02/years/2025/parcels': { data: [] },
    });
    renderWithClient(<HistoricalImageryPanel initialClusterId="MH-PUNE-02" />);

    const clusterSelect = await waitFor(() => screen.getByLabelText('Cluster'));
    expect(clusterSelect).toHaveValue('MH-PUNE-02');

    await screen.findByText('Comparing 2024 to 2025 - the only pair that can generate governance alerts.');

    const yearSelect = await screen.findByTestId('map-year-select');
    expect(yearSelect).toHaveValue('2025');
  });
});