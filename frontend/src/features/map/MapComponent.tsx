import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';

interface ParcelData {
  id: string;
  canonicalParcelId: string | null;
  ulpin: string | null;
  stateCode: string;
  districtCode: string;
  localBodyCode: string;
  geometry: GeoJSON.Geometry;
  areaSqM: number;
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

const MapComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const { data: parcels = [], isLoading, error } = useQuery<ParcelData[]>(
    ['parcels'],
    async () => {
      const response = await apiService.get('/gis/parcels');
      return response.data.parcels;
    },
  );

  // Initialize the map once the container is mounted. The container renders
  // unconditionally (see JSX below) so this ref is populated on first effect run.
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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Push parcel data onto the map whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || parcels.length === 0) return;

    const geojson: GeoJSON.FeatureCollection = {
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
        geometry: parcel.geometry,
      })),
    };

    const applyData = () => {
      const source = map.getSource('parcels-source') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
        return;
      }

      map.addSource('parcels-source', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'parcels-layer',
        type: 'fill',
        source: 'parcels-source',
        paint: {
          'fill-color': [
            'match',
            ['get', 'stateCode'],
            'DL', '#ef4444', // Delhi - red
            'MH', '#f97316', // Maharashtra - orange
            'KA', '#10b981', // Karnataka - green
            '#6b7280', // default - gray
          ],
          'fill-opacity': 0.6,
          'fill-outline-color': '#ffffff',
        },
      });

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

      map.on('mouseenter', 'parcels-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'parcels-layer', () => {
        map.getCanvas().style.cursor = '';
      });
    };

    if (map.isStyleLoaded()) {
      applyData();
    } else {
      map.once('load', applyData);
    }
  }, [parcels]);

  return (
    <div className="relative h-[500px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          Loading parcels...
        </div>
      )}
      {Boolean(error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          Error loading parcels
        </div>
      )}
    </div>
  );
};

export default MapComponent;
