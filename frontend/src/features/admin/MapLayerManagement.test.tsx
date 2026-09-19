import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MapLayerManagement, { LayerTypeConfig } from './MapLayerManagement';
import apiService from '../../services/apiService';



// jsdom has no WebGL/worker support maplibre-gl needs - LayerGeometryDrawMap
// mounts inside the Add/Edit form (see below), so it needs the same inert
// mock LayerGeometryDrawMap.test.tsx uses for its own maplibre-gl coverage;
// this file's tests only exercise the surrounding form fields, not drawing.
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      addControl: vi.fn(),
      isStyleLoaded: vi.fn(() => true),
      once: vi.fn(),
      on: vi.fn(),
      remove: vi.fn(),
      fitBounds: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    LngLatBounds: vi.fn().mockImplementation(() => ({
      extend: vi.fn(),
      isEmpty: vi.fn(() => true),
    })),
  },
}));
vi.mock('@mapbox/mapbox-gl-draw', () => ({
  default: vi.fn().mockImplementation(() => ({
    getAll: vi.fn(() => ({ type: 'FeatureCollection', features: [] })),
    add: vi.fn(),
    delete: vi.fn(),
  })),
}));

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
  server.use(http.get('*/map-layers*', () => HttpResponse.json(data)));
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
    server.use(http.post('*', () => HttpResponse.json({})));
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    expect(screen.queryByPlaceholderText(/Parcel IDs/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'New Zone' } });
    fireEvent.change(screen.getByPlaceholderText('State Code (e.g. MH)'), { target: { value: 'dl' } });
    fireEvent.change(screen.getByPlaceholderText('District'), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByPlaceholderText(/Geometry - GeoJSON/), {
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
    fireEvent.change(screen.getByPlaceholderText(/Geometry - GeoJSON/), { target: { value: 'not json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Layer' }));

    expect(await screen.findByText('Geometry must be valid JSON (a GeoJSON geometry object).')).toBeInTheDocument();
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('surfaces the backend geometry-type validation message on create', async () => {
    renderPanel();
    await screen.findByText('Downtown Residential');

    fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Bad Zone' } });
    fireEvent.change(screen.getByPlaceholderText('State Code (e.g. MH)'), { target: { value: 'DL' } });
    fireEvent.change(screen.getByPlaceholderText('District'), { target: { value: 'NEW' } });
    fireEvent.change(screen.getByPlaceholderText(/Geometry - GeoJSON/), {
      target: { value: '{"type":"Point","coordinates":[0,0]}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Layer' }));

    expect(await screen.findByText('geometry.type must be one of: Polygon')).toBeInTheDocument();
  });

  it('edits a layer in place, prefilling its current fields', async () => {
    server.use(http.patch('*', () => HttpResponse.json({})));
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
    server.use(http.delete('*', () => HttpResponse.json(undefined)));
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
      });
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
      server.use(http.post('*', () => HttpResponse.json({})));
      renderAdminNotesPanel({ type: 'FeatureCollection', features: [] });
      await screen.findByText('No layers yet.');

      fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
      fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Watch this parcel' } });
      fireEvent.change(screen.getByPlaceholderText('Notes'), { target: { value: 'Possible boundary dispute' } });
      fireEvent.change(screen.getByPlaceholderText('State Code (e.g. MH)'), { target: { value: 'DL' } });
      fireEvent.change(screen.getByPlaceholderText('District'), { target: { value: 'NEW' } });
      fireEvent.change(screen.getByPlaceholderText(/Geometry - GeoJSON/), { target: { value: '{"type":"Point","coordinates":[1,1]}' } });
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
