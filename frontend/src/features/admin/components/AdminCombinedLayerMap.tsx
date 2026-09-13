import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../../services/apiService';
import { SpatialFeatureCollection } from '../../types/spatial';

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
  layers: [{ id: 'background', type: 'raster', source: 'background', minzoom: 0, maxzoom: 19 }],
};

function setSourceData(map: maplibregl.Map, sourceId: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}

function boundsOfFeatureCollections(collections: GeoJSON.FeatureCollection[]): maplibregl.LngLatBounds | null {
  const bounds = new maplibregl.LngLatBounds();
  const extend = (coords: any): void => {
    if (typeof coords[0] === 'number') {
      bounds.extend(coords as [number, number]);
    } else {
      coords.forEach(extend);
    }
  };
  for (const fc of collections) {
    for (const feature of fc.features) {
      if ('coordinates' in feature.geometry) extend(feature.geometry.coordinates);
    }
  }
  return bounds.isEmpty() ? null : bounds;
}

type CombinedLayerKey = 'zoning' | 'restriction' | 'infrastructure' | 'adminNotes';
const LAYER_KEYS: CombinedLayerKey[] = ['zoning', 'restriction', 'infrastructure', 'adminNotes'];

// Admin-only "see everything at once" view (docs/ADMIN_PANEL_ISSUES.md
// Coming Soon #3 follow-up, per the user's explicit "common map showing all
// layer in admin only") - all four GIS layers rendered together, unlike the
// shared citizen/officer map (features/map/MapComponent.tsx) which only
// loads overlays once a parcel is selected and never fetches admin-notes at
// all. Deliberately a separate component (not an addition to MapComponent)
// so admin-notes stays structurally unreachable from the shared map, the
// same separation LayerGeometryDrawMap already establishes for the drawing
// tool. Small dataset (a handful of demo layers), so every layer is fetched
// unfiltered rather than needing a state/district picker.
const AdminCombinedLayerMap: React.FC = () => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<Record<CombinedLayerKey, boolean>>({
    zoning: true,
    restriction: true,
    infrastructure: true,
    adminNotes: true,
  });
  const toggleLayer = (key: CombinedLayerKey) => setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  const { data: zoningFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(['gis/zoning-overlays', 'combined'], async () => (await apiService.get('/gis/zoning-overlays')).data);
  const { data: restrictionFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(['gis/restriction-zones', 'combined'], async () => (await apiService.get('/gis/restriction-zones')).data);
  const { data: infrastructureFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(['gis/infrastructure', 'combined'], async () => (await apiService.get('/gis/infrastructure')).data);
  const { data: adminNotesFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(['gis/admin-notes', 'combined'], async () => (await apiService.get('/gis/admin-notes')).data);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({ container: containerRef.current, style: BASE_STYLE, center: [78.9629, 22.5937], zoom: 4 });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    const setup = () => {
      map.addSource('zoning-source', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'zoning-layer',
        type: 'fill',
        source: 'zoning-source',
        paint: {
          'fill-color': ['match', ['get', 'zoneType'], 'RESIDENTIAL', '#3b82f6', 'COMMERCIAL', '#a855f7', 'AGRICULTURAL', '#22c55e', '#94a3b8'],
          'fill-opacity': 0.2,
          'fill-outline-color': ['match', ['get', 'zoneType'], 'RESIDENTIAL', '#1d4ed8', 'COMMERCIAL', '#7e22ce', 'AGRICULTURAL', '#15803d', '#475569'],
        },
      });

      map.addSource('restriction-source', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'restriction-layer',
        type: 'fill',
        source: 'restriction-source',
        paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.25, 'fill-outline-color': '#991b1b' },
      });

      map.addSource('infrastructure-source', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'infrastructure-line-layer',
        type: 'line',
        source: 'infrastructure-source',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': ['match', ['get', 'featureType'], 'ROAD', '#78716c', 'WATER_LINE', '#0ea5e9', '#78716c'], 'line-width': 3 },
      });
      map.addLayer({
        id: 'infrastructure-point-layer',
        type: 'circle',
        source: 'infrastructure-source',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': '#eab308', 'circle-radius': 6, 'circle-stroke-color': '#78350f', 'circle-stroke-width': 1 },
      });

      // Admin Notes has no equivalent on the shared map - a distinct dashed
      // violet style across all three geometry types it can take, so it
      // reads as "this one is different" at a glance next to the other
      // three, official-data layers.
      map.addSource('admin-notes-source', { type: 'geojson', data: EMPTY_FC });
      map.addLayer({
        id: 'admin-notes-fill-layer',
        type: 'fill',
        source: 'admin-notes-source',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#7c3aed', 'fill-opacity': 0.2, 'fill-outline-color': '#5b21b6' },
      });
      map.addLayer({
        id: 'admin-notes-line-layer',
        type: 'line',
        source: 'admin-notes-source',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#7c3aed', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'admin-notes-point-layer',
        type: 'circle',
        source: 'admin-notes-source',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': '#7c3aed', 'circle-radius': 7, 'circle-stroke-color': '#5b21b6', 'circle-stroke-width': 2 },
      });

      setMapReady(true);
    };

    if (map.isStyleLoaded()) setup();
    else map.once('load', setup);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setSourceData(map, 'admin-notes-source', adminNotesFC);
  }, [adminNotesFC, mapReady]);

  // Fit to everything loaded, once, the first time any data arrives.
  const fittedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || fittedRef.current) return;
    const bounds = boundsOfFeatureCollections([zoningFC, restrictionFC, infrastructureFC, adminNotesFC]);
    if (bounds) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      fittedRef.current = true;
    }
  }, [zoningFC, restrictionFC, infrastructureFC, adminNotesFC, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const layerIdsByKey: Record<CombinedLayerKey, string[]> = {
      zoning: ['zoning-layer'],
      restriction: ['restriction-layer'],
      infrastructure: ['infrastructure-line-layer', 'infrastructure-point-layer'],
      adminNotes: ['admin-notes-fill-layer', 'admin-notes-line-layer', 'admin-notes-point-layer'],
    };
    for (const [key, layerIds] of Object.entries(layerIdsByKey) as [CombinedLayerKey, string[]][]) {
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', layerVisibility[key] ? 'visible' : 'none');
      }
    }
  }, [layerVisibility, mapReady]);

  return (
    <div className="relative h-[500px] w-full border-2 sm:border-4 border-ink">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute bottom-2 left-2 bg-surface border-2 border-ink shadow-hard-sm p-2.5 text-xs max-w-[190px]">
        <p className="mb-1.5 font-black uppercase tracking-widest text-[10px] text-ink border-b-2 border-ink/15 pb-1">
          {t('adminPortal.combinedMapLayersHeading')}
        </p>
        {LAYER_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-1.5 py-0.5 text-ink/80 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={layerVisibility[key]}
              onChange={() => toggleLayer(key)}
              className="accent-primary w-3.5 h-3.5 border-2 border-ink"
            />
            {t(`adminPortal.combinedMapLayer.${key}`)}
          </label>
        ))}
      </div>
    </div>
  );
};

export default AdminCombinedLayerMap;
