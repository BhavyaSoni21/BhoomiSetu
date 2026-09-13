import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import LayerGeometryDrawMap from './LayerGeometryDrawMap';

const mockMapInstances: any[] = [];
const mockDrawInstances: any[] = [];

vi.mock('maplibre-gl', () => {
  class MockMap {
    listeners: Record<string, Function[]> = {};
    addControl = vi.fn();
    isStyleLoaded = vi.fn(() => true);
    fitBounds = vi.fn();
    remove = vi.fn();
    once = vi.fn();
    constructor() {
      mockMapInstances.push(this);
    }
    on(event: string, handler: Function) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(handler);
    }
    trigger(event: string, payload?: any) {
      (this.listeners[event] || []).forEach((h) => h(payload));
    }
  }
  class MockNavigationControl {}
  class MockLngLatBounds {
    private points: [number, number][] = [];
    extend(point: [number, number]) {
      this.points.push(point);
    }
    isEmpty() {
      return this.points.length === 0;
    }
  }
  return { default: { Map: MockMap, NavigationControl: MockNavigationControl, LngLatBounds: MockLngLatBounds } };
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
    getAll() {
      return { type: 'FeatureCollection', features: this.features };
    }
  }
  return { default: MockDraw };
});

describe('LayerGeometryDrawMap', () => {
  it('adds no shape and calls no onChange when there is no initial geometry', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    const onChange = vi.fn();
    render(<LayerGeometryDrawMap allowedGeometryTypes={['Polygon']} initialGeometry={null} onChange={onChange} />);

    expect(mockDrawInstances[0].features).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pre-loads the draw tool with an existing geometry, fit to its bounds', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    const geometry: GeoJSON.Geometry = { type: 'Point', coordinates: [73.9, 18.6] };
    render(<LayerGeometryDrawMap allowedGeometryTypes={['Point']} initialGeometry={geometry} onChange={vi.fn()} />);

    expect(mockDrawInstances[0].features).toHaveLength(1);
    expect(mockDrawInstances[0].features[0].geometry).toEqual(geometry);
    expect(mockMapInstances[0].fitBounds).toHaveBeenCalled();
  });

  it('only enables the draw controls for the allowed geometry types', () => {
    mockMapInstances.length = 0;
    mockDrawInstances.length = 0;
    render(<LayerGeometryDrawMap allowedGeometryTypes={['Point', 'LineString']} initialGeometry={null} onChange={vi.fn()} />);

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
    render(<LayerGeometryDrawMap allowedGeometryTypes={['Polygon']} initialGeometry={null} onChange={onChange} />);

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
    render(<LayerGeometryDrawMap allowedGeometryTypes={['Polygon']} initialGeometry={null} onChange={onChange} />);

    mockMapInstances[0].trigger('draw.delete');

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
