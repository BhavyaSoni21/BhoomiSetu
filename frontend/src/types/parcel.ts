// Shape returned by both GET /api/v1/gis/parcels and GET /api/v1/parcels.
// `geometry` comes over the wire as a JSON-encoded string (SQLite dev mode
// stores it as text) - callers must JSON.parse it before handing it to a map.
export interface ParcelSummary {
  id: string;
  canonicalParcelId: string | null;
  ulpin: string | null;
  stateCode: string;
  districtCode: string;
  localBodyCode: string;
  areaSqM: number;
  geometry: string;
}

export function parseParcelGeometry(geometry: string | GeoJSON.Geometry): GeoJSON.Geometry {
  return typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
}
