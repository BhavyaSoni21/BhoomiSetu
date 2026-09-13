import { useMutation, useQuery } from '@tanstack/react-query';
import apiService from '../../../services/apiService';
import { CategorizedParcel, ClusterSummary, HistoricalComparisonResult } from '../../types/historicalImagery';

export const useHistoricalClusters = () =>
  useQuery<ClusterSummary[]>(['historical-imagery', 'clusters'], async () => {
    const response = await apiService.get('/historical-imagery/clusters');
    return response.data;
  });

// Real parcel geometry + a real ParcelCategory per parcel for one year -
// what HistoricalImageryPanel renders on the live map (features/map/MapComponent.tsx).
export const useCategorizedParcels = (clusterId: string | null, year: number | null) =>
  useQuery<CategorizedParcel[]>(
    ['historical-imagery', 'cluster-parcels', clusterId, year],
    async () => {
      const response = await apiService.get(`/historical-imagery/clusters/${clusterId}/years/${year}/parcels`);
      return response.data;
    },
    { enabled: !!clusterId && !!year },
  );

export const useCompareHistoricalYears = () =>
  useMutation<HistoricalComparisonResult, Error, { clusterId: string; fromYear: number; toYear: number }>(
    async ({ clusterId, fromYear, toYear }) => {
      // Overrides apiService's global 10s default - this request can involve
      // a real LLM call generating a narrative for up to 10 parcels
      // (HistoricalComparisonService's MAX_LLM_NARRATIVE_PARCELS cap), which
      // a live test measured at up to ~30-40s.
      const response = await apiService.post(`/historical-imagery/clusters/${clusterId}/compare`, { fromYear, toYear }, { timeout: 60000 });
      return response.data;
    },
  );
