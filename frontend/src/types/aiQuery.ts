import { ParcelSummary } from './parcel';

// Shape returned by POST /api/v1/ai/query.
export interface AiQueryResponse {
  filters: Record<string, string | boolean>;
  totalMatches: number;
  results: ParcelSummary[];
}
