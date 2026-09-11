import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../map/maplibreWorkerUrl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Plus } from 'lucide-react';

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

// A starter rectangle sized relative to whatever's currently in view (~12%
// of the visible span on each side of center), not a fixed degree offset -
// so it reads as a sensibly-sized zone whether the admin is zoomed to a
// single district or the whole country, rather than a speck or an
// off-screen sliver.
function centeredRectangle(map: maplibregl.Map): GeoJSON.Polygon {
  const { lng, lat } = map.getCenter();
  const bounds = map.getBounds();
  const halfLng = (bounds.getEast() - bounds.getWest()) * 0.12;
  const halfLat = (bounds.getNorth() - bounds.getSouth()) * 0.12;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - halfLng, lat - halfLat],
        [lng + halfLng, lat - halfLat],
        [lng + halfLng, lat + halfLat],
        [lng - halfLng, lat + halfLat],
        [lng - halfLng, lat - halfLat],
      ],
    ],
  };
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
//
// The draw toolbar's own polygon/point/line icons (top-left) still work,
// but they assume the admin already knows mapbox-gl-draw's click-each-
// vertex-then-close interaction. The "Add Zone" button below (per the
// user's explicit "there should be a button for adding zone that will add
// a zone in the middle of the map and that should be editable") is a
// one-click alternative for Polygon-capable layers: it drops a ready-made
// rectangle at the current map center and immediately selects it in
// direct_select mode, so an admin can just drag its corners into place
// instead of drawing from scratch.
const LayerGeometryDrawMap: React.FC<LayerGeometryDrawMapProps> = ({ allowedGeometryTypes, initialGeometry, onChange }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const canAddZone = allowedGeometryTypes.includes('Polygon');

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [78.9629, 22.5937], // Center of India
      zoom: 4,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        point: allowedGeometryTypes.includes('Point'),
        line_string: allowedGeometryTypes.includes('LineString'),
        polygon: allowedGeometryTypes.includes('Polygon'),
        trash: true,
      },
    });
    drawRef.current = draw;
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

    // mapbox-gl-draw fires these three custom events on the map's own
    // emitter - not part of maplibre-gl's own MapEventType union (its .on()
    // overloads only accept maplibre's own event names), so this narrow
    // cast is needed for the same reason the addControl one above is: the
    // two libraries' types were never written to know about each other.
    const drawEvents = map as unknown as { on: (type: string, listener: () => void) => void };
    drawEvents.on('draw.create', emitSingleShape);
    drawEvents.on('draw.update', emitSingleShape);
    drawEvents.on('draw.delete', emitSingleShape);

    const setup = () => {
      if (initialGeometry) {
        draw.add({ type: 'Feature', properties: {}, geometry: initialGeometry });
        const bounds = boundsOfGeometry(initialGeometry);
        if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
      }
    };
    if (map.isStyleLoaded()) setup();
    else map.once('load', setup);

    return () => {
      mapRef.current = null;
      drawRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddZone = () => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;
    draw.deleteAll();
    const rectangle = centeredRectangle(map);
    const [createdId] = draw.add({ type: 'Feature', properties: {}, geometry: rectangle });
    draw.changeMode('direct_select', { featureId: createdId });
    onChangeRef.current(rectangle);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] text-ink/50">
          {t('adminPortal.drawMapHelperText', { types: allowedGeometryTypes.join(' or ').toLowerCase() })}
        </p>
        {canAddZone && (
          <button
            type="button"
            onClick={handleAddZone}
            className="inline-flex items-center gap-1.5 shrink-0 border-2 border-ink bg-primary hover:bg-primary-strong text-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition active:translate-x-[1px] active:translate-y-[1px]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {t('adminPortal.addZoneCta')}
          </button>
        )}
      </div>
      <div ref={containerRef} className="h-[320px] w-full border-2 border-ink" />
      {canAddZone && <p className="text-[11px] text-ink/50 mt-1">{t('adminPortal.addZoneHelperText')}</p>}
    </div>
  );
};

export default LayerGeometryDrawMap;
