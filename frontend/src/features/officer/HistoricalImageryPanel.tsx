import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useHistoricalClusters } from './historicalImagery';
import HistoricalMapView from './HistoricalMapView';
import HistoricalYearCompare from './HistoricalYearCompare';

// Historical Imagery review screen (docs/FRONTEND_UPGRADE_SPEC.md §8): pick
// a cluster, view any year's real parcel boundaries on the live map (see
// HistoricalMapView, shared with Parcel 360's own embed), and run a
// two-year comparison on demand (HistoricalYearCompare, extracted 2026-09-10
// so Parcel360View.tsx can embed the same comparison inline instead of
// navigating here). The comparison itself (and the alerts it can create)
// stays staff-only, mounted at /officer/historical-imagery - see
// HistoricalImageryPage.
const HistoricalImageryPanel: React.FC<{ initialClusterId?: string | null }> = ({ initialClusterId = null }) => {
  const { t } = useTranslation();
  const { data: clusters = [], isLoading: clustersLoading, error: clustersError } = useHistoricalClusters();
  const [clusterId, setClusterId] = useState<string | null>(initialClusterId);

  // Once the cluster list loads, settle on a cluster (the deep-linked one if
  // it's actually in the list, else the first available).
  useEffect(() => {
    if (clusters.length === 0) return;
    const resolved = clusters.find((c) => c.clusterId === clusterId) ?? clusters[0];
    if (resolved.clusterId !== clusterId) setClusterId(resolved.clusterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters]);

  const selectedCluster = clusters.find((c) => c.clusterId === clusterId) ?? null;

  if (clustersLoading) return <div className="text-ink/60 text-sm">{t('officerPortal.loadingClusters')}</div>;
  if (clustersError) return <div className="text-ink/60 text-sm">{t('officerPortal.errorLoadingClusters')}</div>;
  if (clusters.length === 0) {
    return (
      <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">
        {t('officerPortal.noHistoricalImagery')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="historical-cluster-select" className="block text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1.5">
          {t('officerPortal.clusterLabel')}
        </label>
        <select
          id="historical-cluster-select"
          value={clusterId ?? ''}
          onChange={(event) => setClusterId(event.target.value)}
          className="w-full sm:w-auto border-2 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink"
        >
          {clusters.map((c) => (
            <option key={c.clusterId} value={c.clusterId}>
              {c.clusterId}
            </option>
          ))}
        </select>
      </div>

      {selectedCluster && (
        <>
          <HistoricalMapView clusterId={selectedCluster.clusterId} years={selectedCluster.years} />
          <div className="pt-2 border-t-2 border-ink/10">
            <HistoricalYearCompare key={selectedCluster.clusterId} clusterId={selectedCluster.clusterId} years={selectedCluster.years} />
          </div>
        </>
      )}
    </div>
  );
};

export default HistoricalImageryPanel;
