import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const Parcel360View: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [mapContainerEl, setMapContainerEl] = useState<HTMLDivElement | null>(null);

  const { data: parcel, isLoading, error } = useQuery(
    ['parcel', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}`);
      return response.data;
    },
    {
      enabled: !!id,
    }
  );

  useEffect(() => {
    if (!mapContainerEl || !parcel || !parcel.geometry) return;

    const geometry: GeoJSON.Geometry =
      typeof parcel.geometry === 'string' ? JSON.parse(parcel.geometry) : parcel.geometry;

    // Initialize map
    const mapInstance = new maplibregl.Map({
      container: mapContainerEl,
      style: {
        version: 8,
        sources: {
          background: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [{
          id: 'background',
          type: 'raster',
          source: 'background',
          minzoom: 0,
          maxzoom: 19,
        }],
      },
      center: [78.9629, 22.5937],
      zoom: 15,
    });

    const addParcelLayer = () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry,
        }],
      };

      mapInstance.addSource('parcel-geometry', {
        type: 'geojson',
        data: geojson,
      });

      mapInstance.addLayer({
        id: 'parcel-geometry',
        type: 'fill',
        source: 'parcel-geometry',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.6,
          'fill-outline-color': '#1d4ed8',
        },
      });

      // Fit map to parcel bounds
      const bounds = new maplibregl.LngLatBounds();
      if (geometry.type === 'Polygon') {
        geometry.coordinates[0].forEach((coord) => bounds.extend(coord as [number, number]));
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach((polygon) =>
          polygon[0].forEach((coord) => bounds.extend(coord as [number, number])),
        );
      }
      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 18 });
      }
    };

    if (mapInstance.isStyleLoaded()) {
      addParcelLayer();
    } else {
      mapInstance.once('load', addParcelLayer);
    }

    return () => {
      mapInstance.remove();
    };
  }, [mapContainerEl, parcel]);

  if (isLoading) {
    return <div className="flex h-[600px] items-center justify-center">Loading parcel details...</div>;
  }

  if (error) {
    return <div className="flex h-[600px] items-center justify-center">Error loading parcel details</div>;
  }

  if (!parcel) {
    return <div className="flex h-[600px] items-center justify-center">Parcel not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Parcel Details</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold mb-2">Basic Information</h2>
            <p className="text-gray-600"><strong>Parcel ID:</strong> {parcel.id}</p>
            <p className="text-gray-600"><strong>Canonical Parcel ID:</strong> {parcel.canonicalParcelId || 'N/A'}</p>
            <p className="text-gray-600"><strong>ULPIN:</strong> {parcel.ulpin || 'N/A'}</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Location</h2>
            <p className="text-gray-600"><strong>State:</strong> {parcel.stateCode}</p>
            <p className="text-gray-600"><strong>District:</strong> {parcel.districtCode}</p>
            <p className="text-gray-600"><strong>Local Body Code:</strong> {parcel.localBodyCode}</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Area</h2>
            <p className="text-gray-600"><strong>Area:</strong> {parcel.areaSqM?.toLocaleString()} m²</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Parcel Map</h2>
        <div
          ref={setMapContainerEl}
          className="h-[400px] w-full rounded"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex space-x-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Request Documents
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Report Issue
          </button>
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            onClick={() => window.history.back()}
          >
            Back to Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default Parcel360View;