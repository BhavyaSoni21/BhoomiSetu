import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapComponent from './MapComponent';
import apiService from '../../services/apiService';

const mockMapInstances: any[] = [];

vi.mock('maplibre-gl', () => {
  class MockMap {
    public options: any;
    private listeners: Record<string, Function[]> = {};

    constructor(options: any) {
      this.options = options;
      mockMapInstances.push(this);
    }
    addControl = vi.fn();
    addSource = vi.fn();
    addLayer = vi.fn();
    getSource = vi.fn(() => undefined);
    isStyleLoaded = vi.fn(() => true);
    getCanvas = vi.fn(() => ({ style: {} }));
    remove = vi.fn();
    on(event: string, arg2: any, arg3?: any) {
      const handler = typeof arg2 === 'function' ? arg2 : arg3;
      this.listeners[event] = this.listeners[event] || [];
      if (handler) this.listeners[event].push(handler);
    }
    once = vi.fn();
  }

  class MockNavigationControl {}
  class MockPopup {
    setLngLat() { return this; }
    setHTML() { return this; }
    addTo() { return this; }
  }

  return {
    default: {
      Map: MockMap,
      NavigationControl: MockNavigationControl,
      Popup: MockPopup,
    },
  };
});

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('MapComponent', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
    vi.mocked(apiService.get).mockReset();
  });

  it('initializes the maplibre map even though parcels resolve asynchronously', async () => {
    // Regression test: the map container must mount (and the map must
    // initialize) regardless of the in-flight parcel query's loading state.
    let resolveParcels: (value: any) => void;
    const pending = new Promise((resolve) => {
      resolveParcels = resolve;
    });
    vi.mocked(apiService.get).mockReturnValue(pending as any);

    renderWithClient(<MapComponent />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    resolveParcels!({ data: { parcels: [] } });
  });

  it('shows a loading indicator while parcels are being fetched', async () => {
    let resolveParcels: (value: any) => void;
    const pending = new Promise((resolve) => {
      resolveParcels = resolve;
    });
    vi.mocked(apiService.get).mockReturnValue(pending as any);

    renderWithClient(<MapComponent />);

    expect(screen.getByText(/loading parcels/i)).toBeInTheDocument();
    resolveParcels!({ data: { parcels: [] } });
    await waitFor(() => expect(screen.queryByText(/loading parcels/i)).not.toBeInTheDocument());
  });

  it('requests parcels from the /gis/parcels endpoint (no double /api/v1 prefix)', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [] } });

    renderWithClient(<MapComponent />);

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/gis/parcels'));
  });

  it('adds a parcels-source and parcels-layer once data arrives', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: {
        parcels: [
          {
            id: 'p1',
            canonicalParcelId: 'CAN1',
            ulpin: null,
            stateCode: 'DL',
            districtCode: 'ND',
            localBodyCode: 'DLLB1',
            areaSqM: 100,
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
          },
        ],
      },
    });

    renderWithClient(<MapComponent />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await waitFor(() => expect(mockMapInstances[0].addSource).toHaveBeenCalledWith(
      'parcels-source',
      expect.objectContaining({ type: 'geojson' }),
    ));
    expect(mockMapInstances[0].addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'parcels-layer', type: 'fill' }),
    );
  });
});
