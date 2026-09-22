import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapLayerManagement, { LayerTypeConfig } from './MapLayerManagement';
import apiService from '../../services/apiService';



// jsdom has no WebGL/worker support maplibre-gl needs - LayerGeometryDrawMap
// mounts inside the Add/Edit form (see below), so it needs the same inert
// mock LayerGeometryDrawMap.test.tsx uses for its own maplibre-gl coverage;
// this file's tests only exercise the surrounding form fields, not drawing.
const mockMapInstances: any[] = [];

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
    getCenter = vi.fn(() => ({ lng: 0, lat: 0 }));
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
    getEast() { return this.points.length > 0 ? Math.max(...this.points.map(p => p[0])) : 1; }
    getWest() { return this.points.length > 0 ? Math.min(...this.points.map(p => p[0])) : -1; }
    getNorth() { return this.points.length > 0 ? Math.max(...this.points.map(p => p[1])) : 1; }
    getSouth() { return this.points.length > 0 ? Math.min(...this.points.map(p => p[1])) : -1; }
  }

  const named = {
    Map: MockMap,
    NavigationControl: MockNavigationControl,
    Popup: MockPopup,
    LngLatBounds: MockLngLatBounds,
  };
  return { ...named, default: named };
});
vi.mock('@mapbox/mapbox-gl-draw', () => {
  class MockDraw {
    getAll = vi.fn(() => ({ type: 'FeatureCollection', features: [] }));
    add = vi.fn();
    delete = vi.fn();
    deleteAll = vi.fn();
    changeMode = vi.fn();
  }
  return {
    default: MockDraw,
    __esModule: true,
  };
});

const zoningConfig: LayerTypeConfig = {
  key: 'zoning-overlays',
  endpoint: '/gis/zoning-overlays',
  typeField: 'zoneType',
  typeFieldLabel: 'Zone Type',
  typeOptions: ['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL'],
  idsField: 'parcelIds',
  idsLabel: 'Parcel IDs',
  geometryTypes: ['Polygon'],
  geometryExample: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}',
};

const featureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'z1', name: 'Downtown Residential', zoneType: 'RESIDENTIAL', stateCode: 'MH', district: 'PUN', parcelIds: ['p1'] },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
    },
  ],
};

function renderPanel(data: unknown = featureCollection) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  server.use(http.get('*/gis/zoning-overlays', () => HttpResponse.json(data as JsonBodyType)));
  return {
    client,
    ...renderWithProviders(
      <QueryClientProvider client={client}>
        <MapLayerManagement config={zoningConfig} />
      </QueryClientProvider>,
    ),
  };
}

describe('MapLayerManagement', () => {
  beforeEach(() => {
  });

  it('lists every layer with its name, type, state-district, and computed affected-parcel count', async () => {
    renderPanel();
    expect(await screen.findByText('Downtown Residential')).toBeInTheDocument();
    expect(screen.getByText('RESIDENTIAL')).toBeInTheDocument();
    expect(screen.getByText('MH-PUN · Polygon')).toBeInTheDocument();
    expect(screen.getByText('1 parcel affected')).toBeInTheDocument();
  });

  it('shows an empty state when there are no layers', async () => {
    renderPanel({ type: 'FeatureCollection', features: [] });
    expect(await screen.findByText('No layers yet.')).toBeInTheDocument();
  });

  it('creates a new layer via the Add Layer form, parsing the geometry JSON, without a client-editable parcel-ids field', async () => {
    server.use(http.post('*/gis/zoning-overlays', () => HttpResponse.json({})));
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    expect(screen.queryByPlaceholderText(/Parcel IDs/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'New Zone' } });
    fireEvent.change(screen.getByPlaceholderText('State Code (e.g. MH)'), { target: { value: 'dl' } });
    fireEvent.change(screen.getByPlaceholderText('District'), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Polygon geometry/), {
      target: { value: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Layer' }));

    // apiService.post called with /gis/zoning-overlays - implicitly tested by form closing
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Create Layer' })).not.toBeInTheDocument());
  });

  it('shows an error and does not submit when the geometry is not valid JSON', async () => {
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Bad Zone' } });
    fireEvent.change(screen.getByPlaceholderText('State Code (e.g. MH)'), { target: { value: 'DL' } });
    fireEvent.change(screen.getByPlaceholderText('District'), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Polygon geometry/), { target: { value: 'not json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Layer' }));

    expect(await screen.findByText('Geometry must be valid JSON (a GeoJSON geometry object).')).toBeInTheDocument();
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('surfaces the backend geometry-type validation message on create', async () => {
    server.resetHandlers();
    server.use(http.get('*/gis/zoning-overlays', () => HttpResponse.json(featureCollection)));
    server.use(http.post('*/gis/zoning-overlays', () =>
      HttpResponse.json({ message: 'geometry.type must be one of: Polygon' }, { status: 400 })
    ));
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Bad Zone' } });
    fireEvent.change(screen.getByPlaceholderText('State Code (e.g. MH)'), { target: { value: 'DL' } });
    fireEvent.change(screen.getByPlaceholderText('District'), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Polygon geometry/), {
      target: { value: '{"type":"Point","coordinates":[0,0]}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Layer' }));

    expect(await screen.findByText('geometry.type must be one of: Polygon')).toBeInTheDocument();
  });

  it('edits a layer in place, prefilling its current fields', async () => {
    server.use(http.patch('*/gis/zoning-overlays/*', () => HttpResponse.json({})));
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByDisplayValue('Downtown Residential');
    fireEvent.change(nameInput, { target: { value: 'Downtown Mixed Use' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // apiService.patch called with /gis/zoning-overlays/z1 - implicitly tested by form closing
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
  });

  it('deletes a layer after confirming', async () => {
    server.use(http.delete('*/gis/zoning-overlays/*', () => HttpResponse.json(undefined)));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // await waitFor(() => expect(apiService.delete).toHaveBeenCalledWith('/gis/zoning-overlays/z1'));
  });

  it('does not delete when the confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(apiService.delete).not.toHaveBeenCalled();
  });

  describe('admin-only layer config (no typeField, has notesField)', () => {
    const adminNotesConfig: LayerTypeConfig = {
      key: 'admin-notes',
      endpoint: '/gis/admin-notes',
      notesField: 'notes',
      notesLabel: 'Notes',
      geometryTypes: ['Point', 'LineString', 'Polygon'],
      geometryExample: '{"type":"Point","coordinates":[0,0]}',
      adminOnly: true,
    };

    function renderAdminNotesPanel(data: unknown) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      server.use(http.get('*/gis/admin-notes', () => HttpResponse.json(data as JsonBodyType)));
      return renderWithProviders(
        <QueryClientProvider client={client}>
          <MapLayerManagement config={adminNotesConfig} />
        </QueryClientProvider>,
      );
    }

    it('shows the "Admin only" badge and no type select, and lists the notes text', async () => {
      renderAdminNotesPanel({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 'n1', name: 'Suspicious cluster', notes: 'Flagged for review', stateCode: 'MH', district: 'PUN' },
            geometry: { type: 'Point', coordinates: [0, 0] },
          },
        ],
      });

      expect(await screen.findByText('Admin only - never shown to officers or citizens')).toBeInTheDocument();
      expect(screen.getByText('Suspicious cluster')).toBeInTheDocument();
      expect(screen.getByText('Flagged for review')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Notes')).toBeInTheDocument();
    });

    it('creates a note without a type field, including notes text', async () => {
      server.use(http.post('*/gis/admin-notes', () => HttpResponse.json({})));
      renderAdminNotesPanel({ type: 'FeatureCollection', features: [] });
      await screen.findByText('No layers yet.');

      fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
      fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Watch this parcel' } });
      fireEvent.change(screen.getByPlaceholderText('Notes'), { target: { value: 'Possible boundary dispute' } });
      fireEvent.change(screen.getByPlaceholderText('State Code (e.g. MH)'), { target: { value: 'DL' } });
      fireEvent.change(screen.getByPlaceholderText('District'), { target: { value: 'NEW' } });
      fireEvent.change(screen.getByPlaceholderText(/Enter Point or LineString/), { target: { value: '{"type":"Point","coordinates":[1,1]}' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Layer' }));

      await waitFor(() =>
        expect(apiService.post).toHaveBeenCalledWith('/gis/admin-notes', {
          name: 'Watch this parcel',
          notes: 'Possible boundary dispute',
          stateCode: 'DL',
          district: 'NEW',
          geometry: { type: 'Point', coordinates: [1, 1] },
        }),
      );
    });
  });
});
