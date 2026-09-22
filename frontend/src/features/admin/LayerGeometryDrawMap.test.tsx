import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import LayerGeometryDrawMap from './LayerGeometryDrawMap';

const mockMapInstances: any[] = [];
const mockDrawInstances: any[] = [];

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
    features: any[] = [];
    options: any;
    constructor(options: any) {
      this.options = options;
      mockDrawInstances.push(this);
    }
    add(feature: any) {
      const withId = { ...feature, id: feature.id ?? `f${this.features.length + 1}` };
      this.features.push(withId);
      return [withId.id];
    }
    delete(id: string) {
      this.features = this.features.filter((f) => f.id !== id);
    }
    deleteAll = vi.fn();
    changeMode = vi.fn();
    getAll() {
      return { type: 'FeatureCollection', features: this.features };
    }
  }
  return { default: MockDraw, __esModule: true };
});

describe('LayerGeometryDrawMap', () => {
  it('adds no shape and calls no onChange when there is no initial geometry', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    const onChange = vi.fn();
    renderWithProviders(<LayerGeometryDrawMap allowedGeometryTypes={['Polygon']} initialGeometry={null} onChange={onChange} />);

    expect(mockDrawInstances[0].features).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pre-loads the draw tool with an existing geometry, fit to its bounds', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    const geometry: GeoJSON.Geometry = { type: 'Point', coordinates: [73.9, 18.6] };
    renderWithProviders(<LayerGeometryDrawMap allowedGeometryTypes={['Point']} initialGeometry={geometry} onChange={vi.fn()} />);

    expect(mockDrawInstances[0].features).toHaveLength(1);
    expect(mockDrawInstances[0].features[0].geometry).toEqual(geometry);
    expect(mockMapInstances[0].fitBounds).toHaveBeenCalled();
  });

  it('only enables the draw controls for the allowed geometry types', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    renderWithProviders(<LayerGeometryDrawMap allowedGeometryTypes={['Point', 'LineString']} initialGeometry={null} onChange={vi.fn()} />);

    expect(mockDrawInstances[0].options.controls).toEqual({
      point: true,
      line_string: true,
      polygon: false,
      trash: true,
    });
  });

  it('emits the drawn geometry on draw.create', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    const onChange = vi.fn();
    renderWithProviders(<LayerGeometryDrawMap allowedGeometryTypes={['Polygon']} initialGeometry={null} onChange={onChange} />);

    const draw = mockDrawInstances[0];
    const map = mockMapInstances[0];
    const drawnGeometry: GeoJSON.Geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
    draw.add({ type: 'Feature', properties: {}, geometry: drawnGeometry });
    map.trigger('draw.create');

    expect(onChange).toHaveBeenCalledWith(drawnGeometry);
  });

  it('emits null on draw.delete when nothing remains', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    const onChange = vi.fn();
    renderWithProviders(<LayerGeometryDrawMap allowedGeometryTypes={['Polygon']} initialGeometry={null} onChange={onChange} />);

    mockMapInstances[0].trigger('draw.delete');

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
