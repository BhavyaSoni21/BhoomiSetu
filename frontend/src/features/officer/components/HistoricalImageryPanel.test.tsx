import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HistoricalImageryPanel from './HistoricalImageryPanel';
import apiService from '../../../services/apiService';

vi.mock('../../../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// MapLibre needs real canvas/WebGL support jsdom doesn't provide - stubbed
// with a component that exposes the props HistoricalImageryPanel computes
// (parcels/parcelColors/parcelLabels) so tests can assert the map coloring
// wiring without a real map, matching OfficerPortal.test.tsx's own stub.
vi.mock('../../map/MapComponent', () => ({
  default: (props: { parcels: { id: string }[]; parcelColors?: Record<string, string>; parcelLabels?: Record<string, string> }) => (
    <div data-testid="map-stub">
      <span data-testid="map-parcel-count">{props.parcels.length}</span>
      <span data-testid="map-colors">{JSON.stringify(props.parcelColors)}</span>
      <span data-testid="map-labels">{JSON.stringify(props.parcelLabels)}</span>
    </div>
  ),
}));

beforeEach(() => {
  vi.mocked(apiService.get).mockReset();
  vi.mocked(apiService.post).mockReset();
});

const clusters = [{ clusterId: 'MH-PUNE-01', years: [2022, 2023, 2024, 2025] }];
const categorizedParcels2025 = [
  { id: 'p1', canonicalParcelId: 'MH-PUN-0001', ulpin: null, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: '{}', category: 'DISPUTE_OWNERSHIP' },
  { id: 'p2', canonicalParcelId: 'MH-PUN-0002', ulpin: null, stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 600, geometry: '{}', category: 'NONE' },
];

function mockApiForClusters() {
  vi.mocked(apiService.get).mockImplementation(async (url: string) => {
    if (url === '/historical-imagery/clusters') return { data: clusters };
    if (url === '/historical-imagery/clusters/MH-PUNE-01/years/2025/parcels') return { data: categorizedParcels2025 };
    if (url.includes('/parcels')) return { data: [] };
    throw new Error(`Unexpected GET ${url}`);
  });
}

function renderWithClient(props: { initialClusterId?: string | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HistoricalImageryPanel {...props} />
    </QueryClientProvider>,
  );
}

describe('HistoricalImageryPanel', () => {
  it('shows an empty state when no clusters have imagery yet', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderWithClient();

    expect(await screen.findByText('No historical imagery has been generated yet.')).toBeInTheDocument();
  });

  it('loads the cluster list and compares the two most recent years only - no picker', async () => {
    mockApiForClusters();
    renderWithClient();

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/historical-imagery/clusters'));
    expect(await screen.findByRole('option', { name: 'MH-PUNE-01' })).toBeInTheDocument();

    expect(await screen.findByText('Comparing 2024 to 2025 - the only pair that can generate governance alerts.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'From year' })).not.toBeInTheDocument();
  });

  it('defaults the map year to the newest year, fetches real categorized parcels for it, and colors the map by category', async () => {
    mockApiForClusters();
    renderWithClient();

    expect(await screen.findByLabelText('Map year')).toHaveValue('2025');
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
    mockApiForClusters();
    renderWithClient();

    await screen.findByLabelText('Map year');
    fireEvent.change(screen.getByLabelText('Map year'), { target: { value: '2023' } });

    await waitFor(() =>
      expect(apiService.get).toHaveBeenCalledWith('/historical-imagery/clusters/MH-PUNE-01/years/2023/parcels'),
    );
  });

  it('running a comparison posts the two most recent years and shows each affected parcel with its category change, narrative, and alert badge', async () => {
    mockApiForClusters();
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
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
      },
    });
    renderWithClient();

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
    mockApiForClusters();
    vi.mocked(apiService.post).mockResolvedValue({
      data: { clusterId: 'MH-PUNE-01', fromYear: 2024, toYear: 2025, changeDetected: false, affectedParcels: [] },
    });
    renderWithClient();

    await screen.findByRole('option', { name: 'MH-PUNE-01' });
    fireEvent.click(screen.getByRole('button', { name: /Compare Years/ }));

    expect(await screen.findByText("No parcel's status changed between 2024 and 2025.")).toBeInTheDocument();
  });

  it('shows an error message when the comparison request fails', async () => {
    mockApiForClusters();
    vi.mocked(apiService.post).mockRejectedValue(new Error('network error'));
    renderWithClient();

    await screen.findByRole('option', { name: 'MH-PUNE-01' });
    fireEvent.click(screen.getByRole('button', { name: /Compare Years/ }));

    expect(await screen.findByText('Could not run the comparison. Please try again.')).toBeInTheDocument();
  });

  it('preselects the cluster passed via initialClusterId', async () => {
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url === '/historical-imagery/clusters') {
        return { data: [{ clusterId: 'MH-PUNE-01', years: [2022, 2023] }, { clusterId: 'MH-PUNE-02', years: [2024, 2025] }] };
      }
      if (url.includes('/parcels')) return { data: [] };
      throw new Error(`Unexpected GET ${url}`);
    });
    renderWithClient({ initialClusterId: 'MH-PUNE-02' });

    await waitFor(() => expect(screen.getByLabelText('Cluster')).toHaveValue('MH-PUNE-02'));
    expect(await screen.findByText('Comparing 2024 to 2025 - the only pair that can generate governance alerts.')).toBeInTheDocument();
    expect(screen.getByLabelText('Map year')).toHaveValue('2025');
  });
});
