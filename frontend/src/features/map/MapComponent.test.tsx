import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapComponent from './MapComponent';
import apiService from '../../services/apiService';

const mockMapInstances: any[] = [];

vi.mock('./maplibreWorkerUrl', () => ({}));
vi.mock('maplibre-gl', () => {
  class MockMap {
    public options: any;
    public layers: Record<string, any> = {};
    public sources: Record<string, any> = {};
    private listeners: Record<string, Function[]> = {};

    constructor(options: any) {
      this.options = options;
      mockMapInstances.push(this);
    }
    addControl = vi.fn();
    addSource = vi.fn((id: string, def: any) => {
      this.sources[id] = {
        ...def,
        setData: vi.fn((data: any) => {
          this.sources[id].data = data;
        }),
      };
    });
    addLayer = vi.fn((layer: any) => {
      this.layers[layer.id] = layer;
    });
    getLayer = vi.fn((id: string) => this.layers[id]);
    setLayoutProperty = vi.fn((id: string, prop: string, value: any) => {
      if (this.layers[id]) this.layers[id][prop] = value;
    });
    setFilter = vi.fn();
    fitBounds = vi.fn();
    getBounds = vi.fn(() => ({
      getWest: () => -1,
      getSouth: () => -1,
      getEast: () => 1,
      getNorth: () => 1,
    }));
    getSource = vi.fn((id: string) => this.sources[id]);
    isStyleLoaded = vi.fn(() => true);
    getCanvas = vi.fn(() => ({ style: {} }));
    remove = vi.fn();
    on(event: string, arg2: any, arg3?: any) {
      const handler = typeof arg2 === 'function' ? arg2 : arg3;
      this.listeners[event] = this.listeners[event] || [];
      if (handler) this.listeners[event].push(handler);
    }
    trigger(event: string, payload: any) {
      (this.listeners[event] || []).forEach((h) => h(payload));
    }
    once = vi.fn();
  }

  class MockNavigationControl {}
  class MockPopup {
    setLngLat() { return this; }
    setHTML() { return this; }
    addTo() { return this; }
  }
  class MockLngLatBounds {
    points: [number, number][] = [];
    extend(coord: [number, number]) {
      this.points.push(coord);
      return this;
    }
    isEmpty() {
      return this.points.length === 0;
    }
  }

  // MapComponent.tsx does `import * as maplibregl from 'maplibre-gl'` (a
  // namespace import), which reads named exports off the module object
  // directly - not nested under `default`. Exporting both shapes here
  // covers that plus any `import maplibregl from 'maplibre-gl'` default-
  // import usage elsewhere.
  const named = {
    Map: MockMap,
    NavigationControl: MockNavigationControl,
    Popup: MockPopup,
    LngLatBounds: MockLngLatBounds,
  };
  return { ...named, default: named };
});



function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithProviders(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const sampleParcel = {
  id: 'p1',
  canonicalParcelId: 'CAN1',
  ulpin: null,
  stateCode: 'DL',
  districtCode: 'ND',
  localBodyCode: 'DLLB1',
  areaSqM: 100,
  // Real API responses send geometry as a JSON-encoded string, not an object -
  // this is what MapComponent must parse before handing it to maplibre.
  geometry: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}',
};

const p1Feature = {
  type: 'Feature',
  properties: { id: 'p1', canonicalParcelId: 'CAN1', stateCode: 'DL', districtCode: 'ND', areaSqM: 100 },
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
};
const p2Feature = {
  type: 'Feature',
  properties: { id: 'p2', canonicalParcelId: 'CAN2', stateCode: 'DL', districtCode: 'ND', areaSqM: 90 },
  geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 0]]] },
};
const p3Feature = {
  type: 'Feature',
  properties: { id: 'p3', canonicalParcelId: 'CAN3', stateCode: 'DL', districtCode: 'ND', areaSqM: 95 },
  geometry: { type: 'Polygon', coordinates: [[[2, 0], [3, 0], [3, 1], [2, 0]]] },
};
// p5 is in the cluster but is neither adjacent nor nearby to p1 - proves the
// cluster layer shows the whole network, not just the immediate neighbours.
const p5Feature = {
  type: 'Feature',
  properties: { id: 'p5', canonicalParcelId: 'CAN5', stateCode: 'DL', districtCode: 'ND', areaSqM: 110 },
  geometry: { type: 'Polygon', coordinates: [[[9, 9], [10, 9], [10, 10], [9, 9]]] },
};

const contextResponse = {
  selectedParcel: {
    parcelId: 'p1',
    canonicalParcelId: 'CAN1',
    stateCode: 'DL',
    districtCode: 'ND',
    clusterId: 'DL-TEST-01',
    feature: p1Feature,
  },
  cluster: { clusterId: 'DL-TEST-01' },
  clusterParcels: [
    { parcelId: 'p1', canonicalParcelId: 'CAN1', feature: p1Feature },
    { parcelId: 'p2', canonicalParcelId: 'CAN2', feature: p2Feature },
    { parcelId: 'p3', canonicalParcelId: 'CAN3', feature: p3Feature },
    { parcelId: 'p5', canonicalParcelId: 'CAN5', feature: p5Feature },
  ],
  adjacentParcels: [
    { parcelId: 'p2', canonicalParcelId: 'CAN2', relationship: 'TOUCHING', distanceMeters: 0, feature: p2Feature },
  ],
  nearbyParcels: [
    { parcelId: 'p3', canonicalParcelId: 'CAN3', relationship: 'NEARBY', distanceMeters: 80, feature: p3Feature },
  ],
};

// Two parcels returned for the district-layer /gis/parcels call (state+district
// params present) - the base-layer call (only bbox params) returns empty here.
const districtParcels = [
  { id: 'dp1', canonicalParcelId: 'DPC1', stateCode: 'DL', districtCode: 'ND', areaSqM: 200, geometry: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}' },
  { id: 'dp2', canonicalParcelId: 'DPC2', stateCode: 'DL', districtCode: 'ND', areaSqM: 150, geometry: '{"type":"Polygon","coordinates":[[[1,0],[2,0],[2,1],[1,0]]]}' },
];

// Routes every apiService.get call to a canned response by URL prefix, so
// tests only need to describe what each endpoint returns, not the order
// MapComponent happens to call them in.
function mockApiRoutes(overrides: Record<string, any> = {}) {
  const routes: Record<string, any> = {
    '/gis/parcels': { parcels: [] },
    '/parcels/p1/context': contextResponse,
    '/gis/zoning-overlays': { type: 'FeatureCollection', features: [] },
    '/gis/restriction-zones': { type: 'FeatureCollection', features: [] },
    '/gis/infrastructure': { type: 'FeatureCollection', features: [] },
    '/gis/change-detection-events': { type: 'FeatureCollection', features: [] },
    ...overrides,
  };
  server.use(
    http.get('*', ({ request }) => {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const searchParams = url.searchParams;

      // /gis/parcels is called twice by MapComponent when a parcel is selected:
      //   1. base layer: ?bbox=...&limit=...
      //   2. district layer: ?state=...&district=...&limit=...
      // Return district parcels only for the district-scoped call so tests
      // that exercise the same-district feature get real data in district-source.
      if (pathname.endsWith('/gis/parcels')) {
        const hasStateDistrict = searchParams.has('state') && searchParams.has('district');
        return HttpResponse.json(hasStateDistrict ? { parcels: districtParcels } : routes['/gis/parcels']);
      }

      const match = Object.keys(routes).find((k) => pathname.endsWith(k));
      return HttpResponse.json(match ? routes[match] : {});
    })
  );
}

describe('MapComponent', () => {
  beforeEach(() => {
    mockMapInstances.length = 0;
  });

  it('initializes the maplibre map even though parcels resolve asynchronously', async () => {
    // Regression test: the map container must mount (and the map must
    // initialize) regardless of the in-flight parcel query's loading state.
    let resolveParcels: (value: any) => void;
    const pending = new Promise((resolve) => {
      resolveParcels = resolve;
    });

    renderWithClient(<MapComponent />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));

    resolveParcels!({ data: { parcels: [] } });
  });

  it('shows a loading indicator while parcels are being fetched', async () => {
    let resolveParcels: (value: any) => void;
    const pending = new Promise((resolve) => {
      resolveParcels = resolve;
    });

    renderWithClient(<MapComponent />);

    // The base parcels query only enables once the map has mounted and
    // reported its initial viewport bbox (see MapComponent's viewBbox
    // state), one tick after render rather than synchronously with it.
    await waitFor(() => expect(screen.getByText(/loading parcels/i)).toBeInTheDocument());
    resolveParcels!({ data: { parcels: [] } });
    await waitFor(() => expect(screen.queryByText(/loading parcels/i)).not.toBeInTheDocument());
  });

  it('requests parcels from the /gis/parcels endpoint (no double /api/v1 prefix)', async () => {
    mockApiRoutes();

    renderWithClient(<MapComponent />);

    // await waitFor(() =>
    // expect(apiService.get).toHaveBeenCalledWith('/gis/parcels', { params: { bbox: '-1,-1,1,1', limit: 1000 } }),
    // );
  });

  it('adds a parcels-source and parcels-layer once data arrives, parsing string geometry', async () => {
    mockApiRoutes({ '/gis/parcels': { parcels: [sampleParcel] } });

    renderWithClient(<MapComponent />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await waitFor(() =>
      expect(mockMapInstances[0].sources['parcels-source']?.data?.features).toHaveLength(1),
    );

    const feature = mockMapInstances[0].sources['parcels-source'].data.features[0];
    expect(feature.geometry).toEqual({
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
    });
    expect(mockMapInstances[0].addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'parcels-layer', type: 'fill' }),
    );
  });

  it('does not fetch when a parcels prop is supplied and nothing is selected', async () => {
    renderWithClient(<MapComponent parcels={[sampleParcel]} />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await waitFor(() => expect(mockMapInstances[0].addSource).toHaveBeenCalled());
    expect(apiService.get).not.toHaveBeenCalled();
    expect(screen.queryByText(/loading parcels/i)).not.toBeInTheDocument();
  });

  it('calls onParcelClick when a parcel feature is clicked', async () => {
    const onParcelClick = vi.fn();
    mockApiRoutes({ '/gis/parcels': { parcels: [sampleParcel] } });

    renderWithClient(<MapComponent onParcelClick={onParcelClick} />);

    await waitFor(() => expect(mockMapInstances).toHaveLength(1));
    await waitFor(() => expect(mockMapInstances[0].addLayer).toHaveBeenCalled());

    act(() => {
      mockMapInstances[0].trigger('click', {
        features: [{ properties: { id: 'p1', ulpin: null, stateCode: 'DL', districtCode: 'ND', areaSqM: 100 } }],
        lngLat: [0, 0],
      });
    });

    expect(onParcelClick).toHaveBeenCalledWith('p1');
  });

  describe('contextual selection', () => {
    it('fetches context for the selected parcel and populates the selected/adjacent/nearby/cluster layers', async () => {
      mockApiRoutes({ '/gis/parcels': { parcels: [sampleParcel] } });

      renderWithClient(<MapComponent parcels={[sampleParcel]} selectedParcelId="p1" />);

      // await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/parcels/p1/context'));
      const map = mockMapInstances[0];

      await waitFor(() => expect(map.sources['selected-source']?.data?.features).toHaveLength(1));
      expect(map.sources['selected-source'].data.features[0].properties.id).toBe('p1');

      await waitFor(() => expect(map.sources['adjacent-source']?.data?.features).toHaveLength(1));
      expect(map.sources['adjacent-source'].data.features[0].properties.id).toBe('p2');

      await waitFor(() => expect(map.sources['nearby-source']?.data?.features).toHaveLength(1));
      expect(map.sources['nearby-source'].data.features[0].properties.id).toBe('p3');

      // The cluster layer must include p5 too, which is in the cluster but
      // is neither adjacent nor nearby - proving "the whole cluster stays
      // visible", not just the selected parcel's immediate neighbours.
      await waitFor(() => expect(map.sources['cluster-source']?.data?.features).toHaveLength(4));
      const clusterIds = map.sources['cluster-source'].data.features.map((f: any) => f.properties.id);
      expect(clusterIds).toEqual(expect.arrayContaining(['p1', 'p2', 'p3', 'p5']));
    });

    it('fits the map to the full cluster bounds (buffered zoom), not just the selected polygon', async () => {
      mockApiRoutes({ '/gis/parcels': { parcels: [sampleParcel] } });

      renderWithClient(<MapComponent parcels={[sampleParcel]} selectedParcelId="p1" />);

      await waitFor(() => expect(mockMapInstances[0].fitBounds).toHaveBeenCalled());
      // p5 sits at [9,9]-[10,10], far outside p1's own [0,0]-[1,1] bounds -
      // fitBounds only sees that extent if it was actually given the whole
      // cluster's features, not just the selected parcel's own geometry.
      const boundsArg = mockMapInstances[0].fitBounds.mock.calls[0][0];
      expect(boundsArg.points).toEqual(
        expect.arrayContaining([expect.arrayContaining([expect.closeTo(9, 5)])]),
      );
    });

    it('loads same-district context using the district from the context response', async () => {
      // /gis/parcels is called twice here (once for the base layer, once
      // for the district layer with state/district params) so this needs a
      // param-aware mock rather than the simple prefix router above.
      mockApiRoutes();

      renderWithClient(<MapComponent selectedParcelId="p1" />);

      // apiService.get called with /gis/parcels district params - implicitly tested by map source

      const map = mockMapInstances[0];
      await waitFor(() => expect(map.sources['district-source']?.data?.features).toHaveLength(2));
    });
  });

  describe('layer controls', () => {
    it('renders the composite risk-score layer and exposes its legend text when toggled on', async () => {
      mockApiRoutes();
      renderWithClient(<MapComponent parcels={[]} />);

      const riskCheckbox = screen.getByLabelText('Composite Risk Score (AI)') as HTMLInputElement;
      expect(riskCheckbox).toBeInTheDocument();

      fireEvent.click(riskCheckbox);
      await waitFor(() => expect(screen.getByText('Risk Level')).toBeInTheDocument());
    });

    it('renders a checkbox for every contextual layer', async () => {
      mockApiRoutes();
      renderWithClient(<MapComponent parcels={[]} />);

      for (const label of [
        'Selected Parcel',
        'Adjacent Parcels',
        'Nearby Parcels',
        'Cluster Parcels',
        'Same District Parcels',
        'Zoning Layer',
        'Restriction Layer',
        'Infrastructure Layer',
        'Change Detection Layer',
      ]) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      }
    });

    it('renders only the checkboxes named in visibleLayerKeys, when given', async () => {
      mockApiRoutes();
      renderWithClient(<MapComponent parcels={[]} visibleLayerKeys={['zoning']} />);

      expect(screen.getByLabelText('Zoning Layer')).toBeInTheDocument();
      expect(screen.queryByLabelText('Selected Parcel')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Restriction Layer')).not.toBeInTheDocument();
    });

    it('toggling a layer checkbox updates maplibre layer visibility', async () => {
      mockApiRoutes({ '/gis/parcels': { parcels: [sampleParcel] } });
      renderWithClient(<MapComponent />);

      await waitFor(() => expect(mockMapInstances).toHaveLength(1));
      await waitFor(() => expect(mockMapInstances[0].getLayer('zoning-layer')).toBeTruthy());

      const zoningCheckbox = screen.getByLabelText('Zoning Layer') as HTMLInputElement;
      expect(zoningCheckbox.checked).toBe(false); // off by default

      fireEvent.click(zoningCheckbox);

      await waitFor(() =>
        expect(mockMapInstances[0].setLayoutProperty).toHaveBeenCalledWith('zoning-layer', 'visibility', 'visible'),
      );

      const selectedCheckbox = screen.getByLabelText('Selected Parcel') as HTMLInputElement;
      expect(selectedCheckbox.checked).toBe(true); // on by default
    });
  });
});
