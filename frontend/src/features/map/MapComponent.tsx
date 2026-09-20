import './maplibreWorkerUrl';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { ParcelSummary, parseParcelGeometry } from '../../types/parcel';
import { ParcelContextResponse, SpatialFeatureCollection } from '../../types/spatial';

interface MapComponentProps {
  /** When provided, render exactly these parcels instead of fetching all of them. */
  parcels?: ParcelSummary[];
  /** Parcel id to highlight and load spatial context (neighbours, district, overlays) for. */
  selectedParcelId?: string | null;
  /** Called when a parcel polygon is clicked, in addition to the info popup. */
  onParcelClick?: (parcelId: string) => void;
  /** Per-parcel fill color (hex), keyed by parcel id - overrides the default by-stateCode coloring on the base parcels layer. Used by HistoricalImageryPanel to color parcels by ParcelCategory for a chosen year. */
  parcelColors?: Record<string, string>;
  /** Per-parcel extra popup line, keyed by parcel id - shown under the standard fields when present. */
  parcelLabels?: Record<string, string>;
  /** Zoom/pan to fit the `parcels` prop's own bounds once they load - opt-in so this never changes existing behavior for callers that show all-of-India search results (bare /map, CitizenPortal) without a specific area in mind. */
  fitToParcels?: boolean;
  /** Which legend checkboxes to render (defaults to every LayerKey, i.e. today's behavior) - lets a caller offer a simpler subset, e.g. Parcel 360 showing citizens only a "View Zoning" toggle instead of the full staff-oriented legend. Layer visibility state itself is unaffected; layers not offered here just keep their default visibility. */
  visibleLayerKeys?: LayerKey[];
  /** Hide the bottom-left layer-toggle legend entirely (defaults to shown). For read-only previews, e.g. the public landing page, where the map is a fixed illustration, not an interactive tool. */
  showLayerPanel?: boolean;
  /** Bump this (e.g. ++) to re-fit the map to the selected parcel's cluster/context on demand - the contextual zoom below otherwise only runs once, when `context` itself first loads (React Query caches it), so a "Locate" button needs an explicit way to ask for it again even when nothing about the selection has actually changed. */
  recenterSignal?: number;
  /** Pan/zoom to these bounds (e.g. a cluster picked from a dropdown) and, since the base parcels layer is itself bbox-scoped (see viewBbox below), this also confines the "load every parcel in view" fetch to that cluster instead of whatever the map happened to be showing before - the same nationwide-fetch problem `parcels`/`fitToParcels` solves for callers who already have their own parcel list. */
  focusBounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  /** Initial layer visibility state from parent (e.g. UnifiedMapWrapper's dropdown). */
  initialLayerVisibility?: Record<LayerKey, boolean>;
  /** Callback when layer visibility changes (to sync with parent dropdown). */
  onLayerVisibilityChange?: (visibility: Record<LayerKey, boolean>) => void;
}

type LayerKey =
  | 'selected'
  | 'adjacent'
  | 'nearby'
  | 'cluster'
  | 'sameDistrict'
  | 'zoning'
  | 'restriction'
  | 'infrastructure'
  | 'changeDetection'
  | 'roads'
  | 'buildings'
  | 'landcover'
  | 'elevation';

export type { LayerKey };

// Order drives the toggle list below; keys match the map.layer.* i18n keys.
const LAYER_KEYS: LayerKey[] = [
  'selected',
  'adjacent',
  'nearby',
  'cluster',
  'sameDistrict',
  'zoning',
  'restriction',
  'infrastructure',
  'changeDetection',
  'roads',
  'buildings',
  'landcover',
  'elevation',
];

// Selected/adjacent/nearby/cluster default on: a selected parcel's spatial
// network (the whole point of this component) must never be hidden by
// default. Same-district and the overlay layers stay opt-in.
const DEFAULT_LAYER_VISIBILITY: Record<LayerKey, boolean> = {
  selected: true,
  adjacent: true,
  nearby: true,
  cluster: true,
  sameDistrict: false,
  zoning: false,
  restriction: false,
  infrastructure: false,
  changeDetection: false,
  roads: false,
  buildings: false,
  landcover: false,
  elevation: false,
};

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// OpenStreetMap itself has no satellite imagery (it's a vector street map,
// rendered here as raster tiles) - "satellite-background" is a separate
// free raster source (Esri World Imagery, no API key/registration needed,
// unlike Google Maps/Earth Engine) toggled via the Street/Satellite
// control below. "terrain-background" adds a terrain/topographic layer
// (OpenTopoMap, no API key needed) for elevation context. Only one of the
// three 'background'/'satellite-background'/'terrain-background' layers is
// visible at a time; all always exist in the style so toggling is just a
// layout-visibility flip, not adding/removing sources.
const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    background: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
    'satellite-background': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    },
    'terrain-background': {
      type: 'raster',
      tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenTopoMap contributors',
    },
    // Vector tile sources for terrain layers (loaded dynamically)
    roads: {
      type: 'vector',
      tiles: ['/api/tiles/roads/{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 14,
      attribution: '&copy; OSM via Earth Engine',
    },
    buildings: {
      type: 'vector',
      tiles: ['/api/tiles/buildings/{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 16,
      attribution: '&copy; Microsoft Building Footprints',
    },
    landcover: {
      type: 'vector',
      tiles: ['/api/tiles/landcover/{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 12,
      attribution: '&copy; ESA WorldCover / Dynamic World',
    },
    elevation: {
      type: 'vector',
      tiles: ['/api/tiles/elevation/{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 12,
      attribution: '&copy; Copernicus DEM 30m',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'raster',
      source: 'background',
      minzoom: 0,
      maxzoom: 19,
    },
    {
      id: 'satellite-background',
      type: 'raster',
      source: 'satellite-background',
      minzoom: 0,
      maxzoom: 19,
      layout: { visibility: 'none' },
    },
    {
      id: 'terrain-background',
      type: 'raster',
      source: 'terrain-background',
      minzoom: 0,
      maxzoom: 19,
      layout: { visibility: 'none' },
    },
  ],
};

type Basemap = 'street' | 'satellite' | 'terrain';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] as string));
}

function boundsOfFeatures(features: GeoJSON.Feature[]): maplibregl.LngLatBounds | null {
  const bounds = new maplibregl.LngLatBounds();
  const extend = (coords: any): void => {
    if (typeof coords[0] === 'number') {
      bounds.extend(coords as [number, number]);
    } else {
      coords.forEach(extend);
    }
  };
  for (const feature of features) {
    const geom = feature.geometry;
    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      extend(geom.coordinates);
    } else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
      extend(geom.coordinates);
    } else if (geom.type === 'Point') {
      bounds.extend(geom.coordinates as [number, number]);
    }
  }
  return bounds.isEmpty() ? null : bounds;
}

function ensureLayer(map: maplibregl.Map, sourceId: string, layer: maplibregl.LayerSpecification) {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: EMPTY_FC });
  }
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
}

function setSourceData(map: maplibregl.Map, sourceId: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}

const DEFAULT_STATE_COLORS: Record<string, string> = { DL: '#ef4444', MH: '#f97316', KA: '#10b981' };
const DEFAULT_PARCEL_COLOR = '#6b7280';

const MapComponent: React.FC<MapComponentProps> = ({
  parcels: parcelsProp,
  selectedParcelId,
  onParcelClick,
  parcelColors,
  parcelLabels,
  fitToParcels,
  visibleLayerKeys,
  showLayerPanel = true,
  recenterSignal,
  focusBounds,
  initialLayerVisibility,
  onLayerVisibilityChange,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const onParcelClickRef = useRef(onParcelClick);
  onParcelClickRef.current = onParcelClick;

  // react-i18next's `t` is fixed to whatever language was active at the
  // render that created it (i18n.getFixedT under the hood) - the popup's
  // click handler below is registered once in the mount-only map-init
  // effect, so without this ref it would permanently freeze on whichever
  // language was active on first mount instead of following language
  // switches.
  const tRef = useRef(t);
  tRef.current = t;

  // Selection is internally owned so the component works standalone (e.g. the
  // bare /map route) but stays in sync with a controlling parent when one
  // passes selectedParcelId (e.g. CitizenPortal, Parcel360View).
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(selectedParcelId ?? null);
  useEffect(() => {
    if (selectedParcelId !== undefined) setInternalSelectedId(selectedParcelId);
  }, [selectedParcelId]);

  const selectParcel = (id: string) => {
    setInternalSelectedId(id);
    onParcelClickRef.current?.(id);
  };

  const [layerVisibility, setLayerVisibility] = useState<Record<LayerKey, boolean>>(
    initialLayerVisibility ?? DEFAULT_LAYER_VISIBILITY
  );
  const toggleLayer = (key: LayerKey) => {
    const newVisibility = { ...layerVisibility, [key]: !layerVisibility[key] };
    setLayerVisibility(newVisibility);
    onLayerVisibilityChange?.(newVisibility);
  };

  const [basemap, setBasemap] = useState<Basemap>('street');

  // Current map viewport as "minLng,minLat,maxLng,maxLat", kept in sync via
  // the 'moveend' listener registered in the map-init effect below. Gates
  // the base parcels query so it never fires with no bbox at all - with
  // 3,800+ demo parcels across 58 clusters nationwide, an unscoped fetch
  // means shipping the whole country to every page load (see
  // docs/architecture strategy notes on viewport-based loading).
  const [viewBbox, setViewBbox] = useState<string | null>(null);

  // Base "search results" layer: only fetch our own copy of every parcel
  // when the caller hasn't handed us a (possibly search-filtered) list.
  // Scoped to the current viewport (+ a generous cap) rather than fetching
  // every parcel in the database on every load/pan/zoom.
  const { data: fetchedParcels = [], isLoading, error } = useQuery<ParcelSummary[]>(
    ['parcels', viewBbox],
    async () => {
      const response = await apiService.get('/gis/parcels', { params: { bbox: viewBbox, limit: 1000 } });
      return response.data.parcels;
    },
    { enabled: parcelsProp === undefined && viewBbox !== null },
  );
  const parcels = parcelsProp ?? fetchedParcels;
  const showLoading = parcelsProp === undefined && isLoading;
  const showError = parcelsProp === undefined && Boolean(error);

  // Contextual data for the selected parcel: its full connected cluster,
  // adjacent/nearby neighbours, plus (via `district` below) the wider
  // administrative district it belongs to.
  const { data: context } = useQuery<ParcelContextResponse | null>(
    ['parcel-context', internalSelectedId],
    async () => {
      const response = await apiService.get(`/parcels/${internalSelectedId}/context`);
      return response.data;
    },
    { enabled: !!internalSelectedId },
  );

  const district = context
    ? { state: context.selectedParcel.stateCode, district: context.selectedParcel.districtCode }
    : null;

  const { data: districtParcels = [] } = useQuery<ParcelSummary[]>(
    ['district-parcels', district?.state, district?.district],
    async () => {
      const response = await apiService.get('/gis/parcels', { params: { state: district!.state, district: district!.district, limit: 500 } });
      return response.data.parcels;
    },
    { enabled: !!district },
  );

  function useSpatialLayer(layerPath: string) {
    return useQuery<SpatialFeatureCollection>(
      [layerPath, district?.state, district?.district],
      async () => {
        const response = await apiService.get(`/gis/${layerPath}`, { params: { state: district!.state, district: district!.district } });
        return response.data;
      },
      { enabled: !!district },
    );
  }
  const { data: zoningFC = EMPTY_FC } = useSpatialLayer('zoning-overlays');
  const { data: restrictionFC = EMPTY_FC } = useSpatialLayer('restriction-zones');
  const { data: infrastructureFC = EMPTY_FC } = useSpatialLayer('infrastructure');
  const { data: changeDetectionFC = EMPTY_FC } = useSpatialLayer('change-detection-events');

  // Initialize the map + every source/layer once the container is mounted.
  // The container renders unconditionally (see JSX below) so this ref is
  // populated on first effect run; layers start empty and get data as each
  // query above resolves.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [78.9629, 22.5937], // Center of India
      zoom: 4,
      minZoom: 3,   // Don't zoom out past India being visible
      maxZoom: 18,  // OSM/Esri tiles become unavailable beyond this
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    const setup = () => {
      // Level 4: same-district parcels - low-key fill, sits under everything.
      ensureLayer(map, 'district-source', {
        id: 'district-layer',
        type: 'fill',
        source: 'district-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.sameDistrict ? 'visible' : 'none' },
        paint: { 'fill-color': '#9ca3af', 'fill-opacity': 0.15, 'fill-outline-color': '#6b7280' },
      });

      // Base "search results" layer. Fill color comes from a `fillColor`
      // property computed per-feature in JS (see the base-parcels effect
      // below) rather than a maplibre match expression, so an optional
      // `parcelColors` override (HistoricalImageryPanel coloring parcels by
      // ParcelCategory for a chosen year) is just a different value in that
      // same property - the layer paint itself never needs to change.
      ensureLayer(map, 'parcels-source', {
        id: 'parcels-layer',
        type: 'fill',
        source: 'parcels-source',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': 0.6,
          'fill-outline-color': '#ffffff',
        },
      });

      // Roads - vector tiles
      if (!map.getLayer('roads-layer')) {
        map.addLayer({
          id: 'roads-layer',
          type: 'line',
          source: 'roads',
          'source-layer': 'roads',
          layout: { visibility: DEFAULT_LAYER_VISIBILITY.infrastructure ? 'visible' : 'none' },
          paint: {
            'line-color': ['match', ['get', 'road_type'], 'HIGHWAY', '#dc2626', 'PRIMARY', '#ea580c', 'SECONDARY', '#f97316', 'TERTIARY', '#fbbf24', 'RESIDENTIAL', '#9ca3af', '#6b7280'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 3],
            'line-opacity': 0.8,
          },
        });
      }

      // Buildings - vector tiles
      if (!map.getLayer('buildings-layer')) {
        map.addLayer({
          id: 'buildings-layer',
          type: 'fill',
          source: 'buildings',
          'source-layer': 'buildings',
          layout: { visibility: DEFAULT_LAYER_VISIBILITY.infrastructure ? 'visible' : 'none' },
          paint: {
            'fill-color': ['interpolate', ['linear'], ['get', 'height_m'], 0, '#9ca3af', 10, '#78716c', 30, '#4b5563', 50, '#1f2937'],
            'fill-opacity': 0.7,
            'fill-outline-color': '#374151',
          },
        });
      }

      // Land cover - vector tiles
      if (!map.getLayer('landcover-layer')) {
        map.addLayer({
          id: 'landcover-layer',
          type: 'fill',
          source: 'landcover',
          'source-layer': 'landcover',
          layout: { visibility: DEFAULT_LAYER_VISIBILITY.zoning ? 'visible' : 'none' },
          paint: {
            'fill-color': ['match', ['get', 'class_name'], 
              'Tree cover', '#166534', 'Shrubland', '#65a30d', 'Grassland', '#84cc16', 
              'Cropland', '#eab308', 'Built-up', '#dc2626', 'Water', '#2563eb', 
              'Wetland', '#0891b2', 'Moss/lichen', '#a3a3a3', 'Bare/sparse vegetation', '#d4d4d4', 
              'Snow/ice', '#f0f9ff', '#9ca3af'],
            'fill-opacity': 0.5,
          },
        });
      }

      // Elevation - vector tiles (contour-style visualization)
      if (!map.getLayer('elevation-layer')) {
        map.addLayer({
          id: 'elevation-layer',
          type: 'fill',
          source: 'elevation',
          'source-layer': 'elevation',
          layout: { visibility: DEFAULT_LAYER_VISIBILITY.zoning ? 'visible' : 'none' },
          paint: {
            'fill-color': ['interpolate', ['linear'], ['get', 'mean_elevation_m'], 
              0, '#0d9488', 50, '#16a34a', 100, '#eab308', 200, '#f97316', 500, '#ea580c', 1000, '#dc2626', '#991b1b'],
            'fill-opacity': 0.3,
          },
        });
      }

      // Zoning / restriction / change-detection overlays (still GeoJSON for now - admin layers)
      ensureLayer(map, 'zoning-source', {
        id: 'zoning-layer',
        type: 'fill',
        source: 'zoning-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.zoning ? 'visible' : 'none' },
        paint: {
          'fill-color': ['match', ['get', 'zoneType'], 'RESIDENTIAL', '#3b82f6', 'COMMERCIAL', '#a855f7', 'AGRICULTURAL', '#22c55e', '#94a3b8'],
          'fill-opacity': 0.2,
          'fill-outline-color': ['match', ['get', 'zoneType'], 'RESIDENTIAL', '#1d4ed8', 'COMMERCIAL', '#7e22ce', 'AGRICULTURAL', '#15803d', '#475569'],
        },
      });
      ensureLayer(map, 'restriction-source', {
        id: 'restriction-layer',
        type: 'fill',
        source: 'restriction-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.restriction ? 'visible' : 'none' },
        paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.25, 'fill-outline-color': '#991b1b' },
      });
      ensureLayer(map, 'change-detection-source', {
        id: 'change-detection-layer',
        type: 'fill',
        source: 'change-detection-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.changeDetection ? 'visible' : 'none' },
        paint: { 'fill-color': '#db2777', 'fill-opacity': 0.3, 'fill-outline-color': '#9d174d' },
      });

      // Infrastructure from admin (still GeoJSON)
      ensureLayer(map, 'infrastructure-source', {
        id: 'infrastructure-line-layer',
        type: 'line',
        source: 'infrastructure-source',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.infrastructure ? 'visible' : 'none' },
        paint: {
          'line-color': ['match', ['get', 'featureType'], 'ROAD', '#78716c', 'WATER_LINE', '#0ea5e9', '#78716c'],
          'line-width': 3,
        },
      });
      if (!map.getLayer('infrastructure-point-layer')) {
        map.addLayer({
          id: 'infrastructure-point-layer',
          type: 'circle',
          source: 'infrastructure-source',
          filter: ['==', ['geometry-type'], 'Point'],
          layout: { visibility: DEFAULT_LAYER_VISIBILITY.infrastructure ? 'visible' : 'none' },
          paint: { 'circle-color': '#eab308', 'circle-radius': 6, 'circle-stroke-color': '#78350f', 'circle-stroke-width': 1 },
        });
      }

      // Level 3: the rest of the selected parcel's cluster - lower emphasis,
      // sits above the base/district layers but below adjacent/nearby/selected.
      ensureLayer(map, 'cluster-source', {
        id: 'cluster-layer',
        type: 'fill',
        source: 'cluster-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.cluster ? 'visible' : 'none' },
        paint: { 'fill-color': '#64748b', 'fill-opacity': 0.18, 'fill-outline-color': '#334155' },
      });
      ensureLayer(map, 'cluster-source', {
        id: 'cluster-boundary-layer',
        type: 'line',
        source: 'cluster-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.cluster ? 'visible' : 'none' },
        paint: { 'line-color': '#334155', 'line-width': 2.5, 'line-opacity': 1 },
      });

      // Level 3 / 2 / 1: nearby, adjacent, selected - most prominent on top.
      ensureLayer(map, 'nearby-source', {
        id: 'nearby-layer',
        type: 'line',
        source: 'nearby-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.nearby ? 'visible' : 'none' },
        paint: { 'line-color': '#eab308', 'line-width': 2 },
      });
      ensureLayer(map, 'adjacent-source', {
        id: 'adjacent-layer',
        type: 'line',
        source: 'adjacent-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.adjacent ? 'visible' : 'none' },
        paint: { 'line-color': '#ea580c', 'line-width': 3 },
      });
      ensureLayer(map, 'selected-source', {
        id: 'selected-layer',
        type: 'line',
        source: 'selected-source',
        layout: { visibility: DEFAULT_LAYER_VISIBILITY.selected ? 'visible' : 'none' },
        paint: { 'line-color': '#2563eb', 'line-width': 4 },
      });

      const selectableLayers = ['parcels-layer', 'district-layer', 'cluster-layer', 'nearby-layer', 'adjacent-layer'];
      for (const layerId of selectableLayers) {
        map.on('click', layerId, (e) => {
          const feature = e.features?.[0];
          const id = feature?.properties?.id ?? feature?.properties?.parcelId;
          if (id) selectParcel(String(id));
        });
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      // Popups only on the base layer, to keep interaction simple.
      map.on('click', 'parcels-layer', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as Record<string, string | number | null>;

        const popupT = tRef.current;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="max-w-xs font-sans border-2 border-ink -m-2 p-2 bg-surface">
              <h3 class="font-black uppercase tracking-wide text-xs text-primary mb-1.5 pb-1 border-b-2 border-ink">${escapeHtml(popupT('map.popup.title'))}</h3>
              <p class="text-ink text-xs py-0.5"><strong class="uppercase tracking-wide">${escapeHtml(popupT('map.popup.id'))}:</strong> ${escapeHtml(String(props.id))}</p>
              <p class="text-ink text-xs py-0.5"><strong class="uppercase tracking-wide">${escapeHtml(popupT('map.popup.ulpin'))}:</strong> ${escapeHtml(String(props.ulpin ?? popupT('map.popup.notAvailable')))}</p>
              <p class="text-ink text-xs py-0.5"><strong class="uppercase tracking-wide">${escapeHtml(popupT('map.popup.state'))}:</strong> ${escapeHtml(String(props.stateCode))}</p>
              <p class="text-ink text-xs py-0.5"><strong class="uppercase tracking-wide">${escapeHtml(popupT('map.popup.district'))}:</strong> ${escapeHtml(String(props.districtCode))}</p>
              <p class="text-ink text-xs py-0.5"><strong class="uppercase tracking-wide">${escapeHtml(popupT('map.popup.area'))}:</strong> ${Number(props.areaSqM).toLocaleString()} m&sup2;</p>
              ${props.extraLabel ? `<p class="text-ink text-xs py-0.5 mt-1 pt-1 border-t-2 border-ink/10">${escapeHtml(String(props.extraLabel))}</p>` : ''}
            </div>
          `)
          .addTo(map);
      });

      mapReadyRef.current = true;
      setMapReady(true);

      const updateBbox = () => {
        const bounds = map.getBounds();
        setViewBbox(`${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);
      };
      updateBbox();
      map.on('moveend', updateBbox);
    };

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once('load', setup);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base parcels layer data. When `fitToParcels` is set (HistoricalMapView -
  // a cluster picked from a dropdown, with no `selectedParcelId` to drive
  // the context-based zoom below), also pan/zoom to fit whatever this batch
  // of parcels covers - without this the map just sits at its default
  // all-of-India view no matter which cluster is selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const features: GeoJSON.Feature[] = parcels.map((parcel) => ({
      type: 'Feature',
      properties: {
        id: parcel.id,
        canonicalParcelId: parcel.canonicalParcelId,
        ulpin: parcel.ulpin,
        stateCode: parcel.stateCode,
        districtCode: parcel.districtCode,
        localBodyCode: parcel.localBodyCode,
        areaSqM: parcel.areaSqM,
        fillColor: parcelColors?.[parcel.id] ?? DEFAULT_STATE_COLORS[parcel.stateCode] ?? DEFAULT_PARCEL_COLOR,
        extraLabel: parcelLabels?.[parcel.id] ?? null,
      },
      geometry: parseParcelGeometry(parcel.geometry),
    }));
    setSourceData(map, 'parcels-source', { type: 'FeatureCollection', features });

    if (fitToParcels && features.length > 0) {
      const bounds = boundsOfFeatures(features);
      if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
    }
  }, [parcels, parcelColors, parcelLabels, fitToParcels, mapReady]);

  // Fit to an explicitly-picked cluster's bounds (e.g. OfficerMapPage's
  // cluster dropdown). This also narrows the base parcels fetch below to
  // that cluster, since it's scoped to the current viewport bbox.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusBounds) return;
    map.fitBounds(
      [
        [focusBounds.minLng, focusBounds.minLat],
        [focusBounds.maxLng, focusBounds.maxLat],
      ],
      { padding: 60, maxZoom: 17 },
    );
  }, [focusBounds, mapReady]);

  // Same-district layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setSourceData(map, 'district-source', {
      type: 'FeatureCollection',
      features: districtParcels.map((parcel) => ({
        type: 'Feature',
        properties: { id: parcel.id, canonicalParcelId: parcel.canonicalParcelId },
        geometry: parseParcelGeometry(parcel.geometry),
      })),
    });
  }, [districtParcels, mapReady]);

  // Selected / adjacent / nearby / cluster layers, plus the buffered
  // contextual zoom.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!context) {
      setSourceData(map, 'selected-source', EMPTY_FC);
      setSourceData(map, 'adjacent-source', EMPTY_FC);
      setSourceData(map, 'nearby-source', EMPTY_FC);
      setSourceData(map, 'cluster-source', EMPTY_FC);
      return;
    }

    const selectedFeature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { id: context.selectedParcel.parcelId, canonicalParcelId: context.selectedParcel.canonicalParcelId },
      geometry: parseParcelGeometry(context.selectedParcel.feature.geometry),
    };
    const adjacentFeatures: GeoJSON.Feature[] = context.adjacentParcels.map((n) => ({
      type: 'Feature',
      properties: { id: n.parcelId, canonicalParcelId: n.canonicalParcelId, distanceMeters: n.distanceMeters },
      geometry: parseParcelGeometry(n.feature.geometry),
    }));
    const nearbyFeatures: GeoJSON.Feature[] = context.nearbyParcels.map((n) => ({
      type: 'Feature',
      properties: { id: n.parcelId, canonicalParcelId: n.canonicalParcelId, distanceMeters: n.distanceMeters },
      geometry: parseParcelGeometry(n.feature.geometry),
    }));
    const clusterFeatures: GeoJSON.Feature[] = context.clusterParcels.map((p) => ({
      type: 'Feature',
      properties: { id: p.parcelId, canonicalParcelId: p.canonicalParcelId },
      geometry: parseParcelGeometry(p.feature.geometry),
    }));

    setSourceData(map, 'selected-source', { type: 'FeatureCollection', features: [selectedFeature] });
    setSourceData(map, 'adjacent-source', { type: 'FeatureCollection', features: adjacentFeatures });
    setSourceData(map, 'nearby-source', { type: 'FeatureCollection', features: nearbyFeatures });
    setSourceData(map, 'cluster-source', { type: 'FeatureCollection', features: clusterFeatures });

    // Contextual buffered zoom: fit to the WHOLE cluster (not just the
    // selected polygon, and not just its immediate neighbours) so the
    // selected parcel stays visible inside its full connected network.
    // Falls back to selected+neighbours for parcels with no cluster.
    const bounds =
      boundsOfFeatures(clusterFeatures.length > 0 ? clusterFeatures : [selectedFeature, ...adjacentFeatures, ...nearbyFeatures]);
    if (bounds) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 18 });
    }
  }, [context, mapReady, recenterSignal]);

  // Zoning / restriction / infrastructure / change-detection layer data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setSourceData(map, 'zoning-source', zoningFC);
  }, [zoningFC, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setSourceData(map, 'restriction-source', restrictionFC);
  }, [restrictionFC, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setSourceData(map, 'infrastructure-source', infrastructureFC);
  }, [infrastructureFC, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setSourceData(map, 'change-detection-source', changeDetectionFC);
  }, [changeDetectionFC, mapReady]);

  // Sync layer toggle checkboxes to maplibre layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const layerIdsByKey: Record<LayerKey, string[]> = {
      selected: ['selected-layer'],
      adjacent: ['adjacent-layer'],
      nearby: ['nearby-layer'],
      cluster: ['cluster-layer', 'cluster-boundary-layer'],
      sameDistrict: ['district-layer'],
      zoning: ['zoning-layer', 'landcover-layer', 'elevation-layer'],
      restriction: ['restriction-layer'],
      infrastructure: ['infrastructure-line-layer', 'infrastructure-point-layer', 'roads-layer', 'buildings-layer'],
      changeDetection: ['change-detection-layer'],
      roads: ['roads-layer'],
      buildings: ['buildings-layer'],
      landcover: ['landcover-layer'],
      elevation: ['elevation-layer'],
    };
    for (const [key, layerIds] of Object.entries(layerIdsByKey) as [LayerKey, string[]][]) {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', layerVisibility[key] ? 'visible' : 'none');
        }
      }
    }
  }, [layerVisibility, mapReady]);

  // Street/Satellite/Terrain basemap toggle - only one of the three background
  // raster layers is ever visible.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty('background', 'visibility', basemap === 'street' ? 'visible' : 'none');
    map.setLayoutProperty('satellite-background', 'visibility', basemap === 'satellite' ? 'visible' : 'none');
    map.setLayoutProperty('terrain-background', 'visibility', basemap === 'terrain' ? 'visible' : 'none');
  }, [basemap, mapReady]);

  return (
    <div className="relative h-[500px] w-full border-2 sm:border-4 border-ink">
      <div ref={containerRef} className="h-full w-full" />
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/85 text-ink font-bold uppercase tracking-wide text-sm">
          {t('map.loading')}
        </div>
      )}
      {showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/85 text-secondary-strong font-bold uppercase tracking-wide text-sm">
          {t('map.errorLoading')}
        </div>
      )}
      {showLayerPanel && (
        <div className="absolute top-2 left-2 flex bg-surface border-2 border-ink shadow-hard-sm text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setBasemap('street')}
            className={`px-2.5 py-1.5 font-bold uppercase tracking-wide ${basemap === 'street' ? 'bg-primary text-surface' : 'text-ink/70 hover:bg-ink/5'}`}
          >
            {t('map.basemap.street')}
          </button>
          <button
            type="button"
            onClick={() => setBasemap('satellite')}
            className={`px-2.5 py-1.5 font-bold uppercase tracking-wide border-l-2 border-ink ${basemap === 'satellite' ? 'bg-primary text-surface' : 'text-ink/70 hover:bg-ink/5'}`}
          >
            {t('map.basemap.satellite')}
          </button>
          <button
            type="button"
            onClick={() => setBasemap('terrain')}
            className={`px-2.5 py-1.5 font-bold uppercase tracking-wide border-l-2 border-ink ${basemap === 'terrain' ? 'bg-primary text-surface' : 'text-ink/70 hover:bg-ink/5'}`}
          >
            {t('map.basemap.terrain')}
          </button>
        </div>
      )}
      {showLayerPanel && !initialLayerVisibility && (
        <div className="absolute bottom-2 left-2 bg-surface border-2 border-ink shadow-hard-sm p-2.5 text-xs max-w-[190px]">
          <p className="mb-1.5 font-black uppercase tracking-widest text-[10px] text-ink border-b-2 border-ink/15 pb-1">
            {t('map.layersHeading')}
          </p>
          {(visibleLayerKeys ?? LAYER_KEYS).map((key) => (
            <label key={key} className="flex items-center gap-1.5 py-0.5 text-ink/80 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={layerVisibility[key]}
                onChange={() => toggleLayer(key)}
                className="accent-primary w-3.5 h-3.5 border-2 border-ink"
              />
              {t(`map.layer.${key}`)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapComponent;
