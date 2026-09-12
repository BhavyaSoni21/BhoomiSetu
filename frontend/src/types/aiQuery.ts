import { ParcelSummary } from './parcel';

// Shape returned by POST /api/v1/ai/query. A HELP-intent reply (or a
// DATA_QUERY the model returned with no usable filters) carries only
// intent+reply; a DATA_QUERY with filters also carries the real query
// results the backend ran against those filters.
export interface AiQueryResponse {
  intent: 'DATA_QUERY' | 'HELP';
  reply: string;
  filters?: Record<string, string | boolean>;
  totalMatches?: number;
  results?: ParcelSummary[];
}
