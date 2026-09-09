import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface LayerGeometryDrawMapProps {
  // Which draw tools to offer - a subset of ['Point', 'LineString', 'Polygon'],
  // matching the layer type's own LayerTypeConfig.geometryTypes.
  allowedGeometryTypes: string[];
  // Pre-existing geometry to show/edit (editing a layer) or null (a fresh one).
  // Read once on mount only - the parent remounts this component (via React's
  // natural conditional-render unmount/remount when toggling Add/Edit forms)
  // whenever a different starting geometry is needed, rather than this
  // component watching the prop for changes.
  initialGeometry: GeoJSON.Geometry | null;
  onChange: (geometry: GeoJSON.Geometry | null) => void;
}

const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    background: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'background', type: 'raster', source: 'background', minzoom: 0, maxzoom: 19 }],
};

function boundsOfGeometry(geometry: GeoJSON.Geometry): maplibregl.LngLatBounds | null {
  const bounds = new maplibregl.LngLatBounds();
  const extend = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === 'number') {
      bounds.extend(coords as [number, number]);
    } else {
      (coords as unknown[]).forEach(extend);
    }
  };
  if ('coordinates' in geometry) extend(geometry.coordinates);
  return bounds.isEmpty() ? null : bounds;
}

// Single-shape draw surface for MapLayerManagement's geometry field
// (docs/ADMIN_PANEL_ISSUES.md Coming Soon #3 follow-up, per the user's
// explicit "add a map drawing tool only for this admin authoring") -
// @mapbox/mapbox-gl-draw is map-instance-agnostic (attaches via
// map.addControl, no runtime dependency on the mapbox-gl package itself),
// so it works against maplibre-gl the same way it would against mapbox-gl.
// Deliberately its own small component, separate from the shared
// features/map/MapComponent.tsx (citizen/officer map) - this drawing
// capability must never leak outside Admin Map Layer Authoring.
const LayerGeometryDrawMap: React.FC<LayerGeometryDrawMapProps> = ({ allowedGeometryTypes, initialGeometry, onChange }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [78.9629, 22.5937], // Center of India
      zoom: 4,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        point: allowedGeometryTypes.includes('Point'),
        line_string: allowedGeometryTypes.includes('LineString'),
        polygon: allowedGeometryTypes.includes('Polygon'),
        trash: true,
      },
    });
    // MapboxDraw implements the same IControl shape maplibre-gl expects
    // (onAdd/onRemove) but is typed against mapbox-gl's own IControl -
    // this cast is the standard way these two libraries are combined.
    map.addControl(draw as unknown as maplibregl.IControl, 'top-left');

    // This field maps 1:1 to a single layer record's geometry column, not a
    // general-purpose multi-shape editor - drawing a new shape always
    // replaces whatever was there.
    const emitSingleShape = () => {
      const all = draw.getAll();
      const feature = all.features[all.features.length - 1];
      if (feature && all.features.length > 1) {
        for (const f of all.features) {
          if (f.id !== feature.id) draw.delete(String(f.id));
        }
      }
      onChangeRef.current(feature ? feature.geometry : null);
    };

    map.on('draw.create', emitSingleShape);
    map.on('draw.update', emitSingleShape);
    map.on('draw.delete', emitSingleShape);

    const setup = () => {
      if (initialGeometry) {
        draw.add({ type: 'Feature', properties: {}, geometry: initialGeometry });
        const bounds = boundsOfGeometry(initialGeometry);
        if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
      }
    };
    if (map.isStyleLoaded()) setup();
    else map.once('load', setup);

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={containerRef} className="h-[320px] w-full border-2 border-ink" />
      <p className="text-[11px] text-ink/50 mt-1">
        {t('adminPortal.drawMapHelperText', { types: allowedGeometryTypes.join(' or ').toLowerCase() })}
      </p>
    </div>
  );
};

export default LayerGeometryDrawMap;
