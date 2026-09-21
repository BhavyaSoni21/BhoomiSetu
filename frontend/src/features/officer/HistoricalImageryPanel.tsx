import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useHistoricalClusters } from './historicalImagery';
import HistoricalMapView from './HistoricalMapView';
import HistoricalYearCompare from './HistoricalYearCompare';
import { STATES_AND_DISTRICTS } from '../../data/locationData';

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
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  
  const { data: clusters = [], isLoading: clustersLoading, error: clustersError } = useHistoricalClusters(selectedState || null, selectedDistrict || null);
  const [clusterId, setClusterId] = useState<string | null>(initialClusterId);

  // Once the cluster list loads, settle on a cluster (the deep-linked one if
  // it's actually in the list, else the first available).
  useEffect(() => {
    if (clusters.length === 0) {
      if (clusterId !== null) setClusterId(null);
      return;
    }
    const resolved = clusters.find((c) => c.clusterId === clusterId) ?? clusters[0];
    if (resolved.clusterId !== clusterId) setClusterId(resolved.clusterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters]);

  const selectedStateObj = STATES_AND_DISTRICTS.find((st) => st.code === selectedState);
  const availableDistricts = selectedStateObj ? selectedStateObj.districts : [];

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value);
    setSelectedDistrict('');
  };

  const selectedCluster = clusters.find((c) => c.clusterId === clusterId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 items-end bg-surface-2 p-4 rounded-xl border border-gov-border">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-text-secondary mb-1">State</label>
          <select
            value={selectedState}
            onChange={handleStateChange}
            className="w-full border-2 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink"
          >
            <option value="">-- All States --</option>
            {STATES_AND_DISTRICTS.map((st) => (
              <option key={st.code} value={st.code}>
                {st.name} ({st.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-text-secondary mb-1">District</label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!selectedState}
            className="w-full border-2 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink disabled:opacity-50"
          >
            <option value="">-- All Districts --</option>
            {availableDistricts.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label htmlFor="historical-cluster-select" className="block text-xs font-semibold text-text-secondary mb-1">
            {t('officerPortal.clusterLabel')}
          </label>
          {clustersLoading ? (
            <div className="h-10 flex items-center px-3 text-sm text-ink/60">{t('officerPortal.loadingClusters')}</div>
          ) : clustersError ? (
            <div className="h-10 flex items-center px-3 text-sm text-ink/60">{t('officerPortal.errorLoadingClusters')}</div>
          ) : clusters.length === 0 ? (
            <div className="h-10 flex items-center px-3 text-sm text-ink/60">{t('officerPortal.noHistoricalImagery')}</div>
          ) : (
            <select
              id="historical-cluster-select"
              value={clusterId ?? ''}
              onChange={(event) => setClusterId(event.target.value)}
              className="w-full border-2 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink"
            >
              {clusters.map((c) => (
                <option key={c.clusterId} value={c.clusterId}>
                  {c.clusterId}
                </option>
              ))}
            </select>
          )}
        </div>
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
