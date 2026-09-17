// Shape returned by POST /api/v1/change-detection/analyze.
export interface ChangeAnalysisResponse {
  changeDetected: boolean;
  changedPixelRatio: number;
  changeRegion: GeoJSON.Polygon | null;
  eventId: string | null;
  affectedParcelIds: string[];
  alertsCreated: number;
}

// Shape returned by GET /api/v1/change-detection/clusters.
export interface ClusterOption {
  clusterId: string;
  stateCode: string;
  district: string;
  type: 'city' | 'village';
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
}
