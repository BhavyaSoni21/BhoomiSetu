import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, Sparkles } from 'lucide-react';
import { useCompareHistoricalYears, useHistoricalClusters } from './historicalImagery';
import HistoricalMapView, { CATEGORY_LABELS, CategorySwatch } from './HistoricalMapView';
import { AffectedParcelResult } from '../../types/historicalImagery';

const yearToggleClass = (active: boolean) =>
  `px-3 py-1.5 text-xs font-bold uppercase tracking-wide border-2 border-ink transition ${
    active ? 'bg-primary text-white' : 'bg-surface text-ink/70 hover:text-ink'
  }`;

const ParcelResultRow: React.FC<{ result: AffectedParcelResult }> = ({ result }) => (
  <div className="border-2 border-ink bg-surface px-3.5 py-3">
    <div className="flex items-start justify-between gap-2 mb-1.5">
      <span className="font-bold text-sm text-ink">{result.canonicalParcelId}</span>
      {result.alertId && (
        <span className="inline-block border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-secondary-strong text-white shrink-0">
          Alert raised
        </span>
      )}
    </div>
    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold uppercase tracking-widest text-ink/60">
      <CategorySwatch category={result.fromCategory} />
      {CATEGORY_LABELS[result.fromCategory]}
      <span aria-hidden="true">→</span>
      <CategorySwatch category={result.toCategory} />
      {CATEGORY_LABELS[result.toCategory]}
    </div>
    <p className="text-sm text-ink/80">{result.narrative}</p>
  </div>
);

// Historical Imagery review screen (docs/FRONTEND_UPGRADE_SPEC.md §8): pick
// a cluster, view any year's real parcel boundaries on the live map (see
// HistoricalMapView, shared with Parcel 360's own embed), and run a
// two-year comparison on demand. What differs between the two years is a
// real per-parcel dispute/restriction comparison (no pixel-diff), shown as
// one narrative row per affected parcel rather than an aggregate
// percentage/count. The comparison itself (and the alerts it can create)
// stays staff-only, mounted at /officer/historical-imagery - see
// HistoricalImageryPage.
const HistoricalImageryPanel: React.FC<{ initialClusterId?: string | null }> = ({ initialClusterId = null }) => {
  const { data: clusters = [], isLoading: clustersLoading, error: clustersError } = useHistoricalClusters();
  const [clusterId, setClusterId] = useState<string | null>(initialClusterId);
  const [fromYear, setFromYear] = useState<number | null>(null);
  const [toYear, setToYear] = useState<number | null>(null);
  const compareMutation = useCompareHistoricalYears();

  // Once the cluster list loads, settle on a cluster (the deep-linked one if
  // it's actually in the list, else the first available) and default the
  // year range to that cluster's oldest -> newest snapshot.
  useEffect(() => {
    if (clusters.length === 0) return;
    const resolved = clusters.find((c) => c.clusterId === clusterId) ?? clusters[0];
    if (resolved.clusterId !== clusterId) setClusterId(resolved.clusterId);
    if (resolved.years.length > 0) {
      setFromYear((current) => (current !== null && resolved.years.includes(current) ? current : resolved.years[0]));
      setToYear((current) =>
        current !== null && resolved.years.includes(current) ? current : resolved.years[resolved.years.length - 1],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters]);

  const selectedCluster = clusters.find((c) => c.clusterId === clusterId) ?? null;
  const result = compareMutation.data && compareMutation.data.clusterId === clusterId ? compareMutation.data : null;

  const handleClusterChange = (nextClusterId: string) => {
    setClusterId(nextClusterId);
    compareMutation.reset();
    const next = clusters.find((c) => c.clusterId === nextClusterId);
    if (next && next.years.length > 0) {
      setFromYear(next.years[0]);
      setToYear(next.years[next.years.length - 1]);
    }
  };

  if (clustersLoading) return <div className="text-ink/60 text-sm">Loading available clusters...</div>;
  if (clustersError) return <div className="text-ink/60 text-sm">Error loading historical imagery clusters.</div>;
  if (clusters.length === 0) {
    return (
      <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">
        No historical imagery has been generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="historical-cluster-select" className="block text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1.5">
          Cluster
        </label>
        <select
          id="historical-cluster-select"
          value={clusterId ?? ''}
          onChange={(event) => handleClusterChange(event.target.value)}
          className="w-full sm:w-auto border-2 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink"
        >
          {clusters.map((c) => (
            <option key={c.clusterId} value={c.clusterId}>
              {c.clusterId}
            </option>
          ))}
        </select>
      </div>

      {selectedCluster && <HistoricalMapView clusterId={selectedCluster.clusterId} years={selectedCluster.years} />}

      {selectedCluster && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t-2 border-ink/10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1.5">From year</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="From year">
              {selectedCluster.years.map((year) => (
                <button
                  key={year}
                  type="button"
                  aria-pressed={fromYear === year}
                  onClick={() => setFromYear(year)}
                  className={yearToggleClass(fromYear === year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1.5">To year</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="To year">
              {selectedCluster.years.map((year) => (
                <button
                  key={year}
                  type="button"
                  aria-pressed={toYear === year}
                  onClick={() => setToYear(year)}
                  className={yearToggleClass(toYear === year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => clusterId && fromYear && toYear && compareMutation.mutate({ clusterId, fromYear, toYear })}
        disabled={!clusterId || !fromYear || !toYear || fromYear === toYear || compareMutation.isLoading}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest bg-accent text-ink border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        {compareMutation.isLoading ? 'Comparing...' : 'Compare Years'}
      </button>

      {fromYear !== null && toYear !== null && fromYear === toYear && (
        <p className="text-xs text-ink/60 text-center">Pick two different years to compare.</p>
      )}

      {compareMutation.isError && (
        <p className="text-xs font-medium text-secondary-strong text-center">Could not run the comparison. Please try again.</p>
      )}

      {result && (
        <div className="space-y-3">
          {result.changeDetected ? (
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-secondary-strong shrink-0" aria-hidden="true" />
              <p className="text-sm font-bold text-ink">
                {result.affectedParcels.length} parcel{result.affectedParcels.length === 1 ? '' : 's'} changed status between{' '}
                {result.fromYear} and {result.toYear}.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <p className="text-sm font-bold text-ink">No parcel's status changed between {result.fromYear} and {result.toYear}.</p>
            </div>
          )}

          {result.affectedParcels.length > 0 && (
            <div className="space-y-2">
              {result.affectedParcels.map((parcel) => (
                <ParcelResultRow key={parcel.parcelId} result={parcel} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoricalImageryPanel;
