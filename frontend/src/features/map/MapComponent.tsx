import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
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
  | 'changeDetection';

const LAYER_LABELS: Record<LayerKey, string> = {
  selected: 'Selected Parcel',
  adjacent: 'Adjacent Parcels',
  nearby: 'Nearby Parcels',
  cluster: 'Cluster Parcels',
  sameDistrict: 'Same District Parcels',
  zoning: 'Zoning Layer',
  restriction: 'Restriction Layer',
  infrastructure: 'Infrastructure Layer',
  changeDetection: 'Change Detection Layer',
};

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
};

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

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
  layers: [
    {
      id: 'background',
      type: 'raster',
      source: 'background',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

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

const MapComponent: React.FC<MapComponentProps> = ({ parcels: parcelsProp, selectedParcelId, onParcelClick }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const onParcelClickRef = useRef(onParcelClick);
  onParcelClickRef.current = onParcelClick;

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

  const [layerVisibility, setLayerVisibility] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYER_VISIBILITY);
  const toggleLayer = (key: LayerKey) => setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  // Base "search results" layer: only fetch our own copy of every parcel
  // when the caller hasn't handed us a (possibly search-filtered) list.
  const { data: fetchedParcels = [], isLoading, error } = useQuery<ParcelSummary[]>(
    ['parcels'],
    async () => {
      const response = await apiService.get('/gis/parcels');
      return response.data.parcels;
    },
    { enabled: parcelsProp === undefined },
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

      // Base "search results" layer.
      ensureLayer(map, 'parcels-source', {
        id: 'parcels-layer',
        type: 'fill',
        source: 'parcels-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'stateCode'],
            'DL', '#ef4444',
            'MH', '#f97316',
            'KA', '#10b981',
            '#6b7280',
          ],
          'fill-opacity': 0.6,
          'fill-outline-color': '#ffffff',
        },
      });

      // Zoning / restriction / change-detection overlays.
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

      // Infrastructure: lines (roads/utilities) and points (substations etc.) from one source.
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
        paint: { 'fill-color': '#64748b', 'fill-opacity': 0.25, 'fill-outline-color': '#334155' },
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

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="max-w-xs">
              <h3 class="font-semibold text-gray-800">Parcel Details</h3>
              <p class="text-gray-600"><strong>ID:</strong> ${escapeHtml(String(props.id))}</p>
              <p class="text-gray-600"><strong>ULPIN:</strong> ${escapeHtml(String(props.ulpin ?? 'N/A'))}</p>
              <p class="text-gray-600"><strong>State:</strong> ${escapeHtml(String(props.stateCode))}</p>
              <p class="text-gray-600"><strong>District:</strong> ${escapeHtml(String(props.districtCode))}</p>
              <p class="text-gray-600"><strong>Area:</strong> ${Number(props.areaSqM).toLocaleString()} m&sup2;</p>
            </div>
          `)
          .addTo(map);
      });

      mapReadyRef.current = true;
      setMapReady(true);
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

  // Base parcels layer data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setSourceData(map, 'parcels-source', {
      type: 'FeatureCollection',
      features: parcels.map((parcel) => ({
        type: 'Feature',
        properties: {
          id: parcel.id,
          canonicalParcelId: parcel.canonicalParcelId,
          ulpin: parcel.ulpin,
          stateCode: parcel.stateCode,
          districtCode: parcel.districtCode,
          localBodyCode: parcel.localBodyCode,
          areaSqM: parcel.areaSqM,
        },
        geometry: parseParcelGeometry(parcel.geometry),
      })),
    });
  }, [parcels, mapReady]);

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
      geometry: context.selectedParcel.feature.geometry,
    };
    const adjacentFeatures: GeoJSON.Feature[] = context.adjacentParcels.map((n) => ({
      type: 'Feature',
      properties: { id: n.parcelId, canonicalParcelId: n.canonicalParcelId, distanceMeters: n.distanceMeters },
      geometry: n.feature.geometry,
    }));
    const nearbyFeatures: GeoJSON.Feature[] = context.nearbyParcels.map((n) => ({
      type: 'Feature',
      properties: { id: n.parcelId, canonicalParcelId: n.canonicalParcelId, distanceMeters: n.distanceMeters },
      geometry: n.feature.geometry,
    }));
    const clusterFeatures: GeoJSON.Feature[] = context.clusterParcels.map((p) => ({
      type: 'Feature',
      properties: { id: p.parcelId, canonicalParcelId: p.canonicalParcelId },
      geometry: p.feature.geometry,
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
  }, [context, mapReady]);

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
      cluster: ['cluster-layer'],
      sameDistrict: ['district-layer'],
      zoning: ['zoning-layer'],
      restriction: ['restriction-layer'],
      infrastructure: ['infrastructure-line-layer', 'infrastructure-point-layer'],
      changeDetection: ['change-detection-layer'],
    };
    for (const [key, layerIds] of Object.entries(layerIdsByKey) as [LayerKey, string[]][]) {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', layerVisibility[key] ? 'visible' : 'none');
        }
      }
    }
  }, [layerVisibility, mapReady]);

  return (
    <div className="relative h-[500px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          Loading parcels...
        </div>
      )}
      {showError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          Error loading parcels
        </div>
      )}
      <div className="absolute bottom-2 left-2 rounded bg-white/90 p-2 text-xs shadow max-w-[180px]">
        <p className="mb-1 font-semibold text-gray-700">Layers</p>
        {(Object.keys(LAYER_LABELS) as LayerKey[]).map((key) => (
          <label key={key} className="flex items-center gap-1.5 py-0.5 text-gray-700">
            <input type="checkbox" checked={layerVisibility[key]} onChange={() => toggleLayer(key)} />
            {LAYER_LABELS[key]}
          </label>
        ))}
      </div>
    </div>
  );
};

export default MapComponent;
