// Shapes returned by GET /api/v1/parcels/:id/neighbours and the
// GET /api/v1/gis/{zoning-overlays,restriction-zones,infrastructure,change-detection-events}
// read endpoints. Geometry here is already a parsed GeoJSON object (unlike
// ParcelSummary.geometry, which is a raw JSON string) since these endpoints
// return proper GeoJSON Features/FeatureCollections directly.

export interface ParcelFeature {
  type: 'Feature';
  properties: {
    id: string;
    canonicalParcelId: string | null;
    stateCode: string;
    districtCode: string;
    areaSqM: number;
  };
  geometry: GeoJSON.Geometry;
}

export interface NeighbourEntry {
  parcelId: string;
  canonicalParcelId: string | null;
  relationship: 'TOUCHING' | 'NEARBY';
  distanceMeters: number | null;
  feature: ParcelFeature;
}

export interface SelectedParcelEntry {
  parcelId: string;
  canonicalParcelId: string | null;
  stateCode: string;
  districtCode: string;
  clusterId: string | null;
  feature: ParcelFeature;
}

export interface NeighboursResponse {
  selectedParcel: SelectedParcelEntry;
  adjacentParcels: NeighbourEntry[];
  nearbyParcels: NeighbourEntry[];
}

export interface ClusterParcelEntry {
  parcelId: string;
  canonicalParcelId: string | null;
  feature: ParcelFeature;
}

// GET /api/v1/parcels/:id/context - selected parcel + its full connected
// cluster (every parcel sharing clusterId) + adjacent/nearby, so a selected
// parcel is never shown alone.
export interface ParcelContextResponse {
  selectedParcel: SelectedParcelEntry;
  cluster: { clusterId: string | null };
  clusterParcels: ClusterParcelEntry[];
  adjacentParcels: NeighbourEntry[];
  nearbyParcels: NeighbourEntry[];
}

export type SpatialFeatureCollection = GeoJSON.FeatureCollection;
