// Shape returned by POST /api/v1/change-detection/analyze.
export interface ChangeAnalysisResponse {
  changeDetected: boolean;
  changedPixelRatio: number;
  changeRegion: GeoJSON.Polygon | null;
  eventId: string | null;
  affectedParcelIds: string[];
  alertsCreated: number;
}
