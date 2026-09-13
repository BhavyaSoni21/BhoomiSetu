import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, CheckCircle2, Sparkles } from 'lucide-react';
import { useCompareHistoricalYears } from '../hooks/historicalImagery';
import { CATEGORY_LABELS, CategorySwatch } from './HistoricalMapView';
import { AffectedParcelResult } from '../../types/historicalImagery';

const ParcelResultRow: React.FC<{ result: AffectedParcelResult }> = ({ result }) => {
  const { t } = useTranslation();
  return (
    <div className="border-2 border-ink bg-surface px-3.5 py-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-bold text-sm text-ink">{result.canonicalParcelId}</span>
        {result.alertId && (
          <span className="inline-block border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-secondary-strong text-white shrink-0">
            {t('officerPortal.alertRaisedBadge')}
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
};

interface HistoricalYearCompareProps {
  clusterId: string;
  years: number[];
}

// The actual two-year comparison (Compare button, per-parcel narrative
// results) - extracted out of HistoricalImageryPanel.tsx 2026-09-10 (per the
// user's explicit "the compare years data in the parcel 360 should also not
// redirect to historical analysis, this analysis should be done there only
// in the parcel 360") so Parcel360View.tsx can embed it directly instead of
// navigating to the standalone /officer/historical-imagery page.
// Unlike HistoricalImageryPanel, this component takes clusterId/years as
// props rather than owning a cluster picker or the map itself - the caller
// (HistoricalImageryPanel, or Parcel360View which already shows its own
// year-based map above this) is responsible for both. Callers should key
// this component by clusterId so switching clusters resets cleanly (see
// LayerGeometryDrawMap.tsx for the same convention).
//
// No year picker any more (removed 2026-09-10, per the user's explicit "I
// want the governance alerts based on the 2025-2026 differences only") -
// the backend (HistoricalComparisonService.compare) now rejects any pair
// other than CURRENT_YEAR-1 -> CURRENT_YEAR with a 400, since that's the
// only comparison allowed to generate governance alerts. `years` arrives
// sorted ascending (HistoricalComparisonService.listClusters orders by
// year ASC) ending at CURRENT_YEAR, so the two most recent entries are
// exactly that pair - no hardcoded literals needed here.
const HistoricalYearCompare: React.FC<HistoricalYearCompareProps> = ({ clusterId, years }) => {
  const { t } = useTranslation();
  const sortedYears = [...years].sort((a, b) => a - b);
  const toYear = sortedYears.length > 0 ? sortedYears[sortedYears.length - 1] : null;
  const fromYear = sortedYears.length > 1 ? sortedYears[sortedYears.length - 2] : null;
  const compareMutation = useCompareHistoricalYears();

  const result = compareMutation.data && compareMutation.data.clusterId === clusterId ? compareMutation.data : null;

  if (fromYear === null || toYear === null) {
    return <p className="text-xs text-ink/60 text-center">{t('officerPortal.notEnoughHistoricalYears')}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/70">{t('officerPortal.comparingYearsLabel', { fromYear, toYear })}</p>

      <button
        type="button"
        onClick={() => clusterId && compareMutation.mutate({ clusterId, fromYear, toYear })}
        disabled={!clusterId || compareMutation.isLoading}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest bg-accent text-ink border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        {compareMutation.isLoading ? t('officerPortal.comparing') : t('officerPortal.compareYearsCta')}
      </button>

      {compareMutation.isError && (
        <p className="text-xs font-medium text-secondary-strong text-center">{t('officerPortal.comparisonError')}</p>
      )}

      {result && (
        <div className="space-y-3">
          {result.changeDetected ? (
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-secondary-strong shrink-0" aria-hidden="true" />
              <p className="text-sm font-bold text-ink">
                {t('officerPortal.parcelsChangedStatus', {
                  count: result.affectedParcels.length,
                  fromYear: result.fromYear,
                  toYear: result.toYear,
                })}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <p className="text-sm font-bold text-ink">
                {t('officerPortal.noParcelsChangedStatus', { fromYear: result.fromYear, toYear: result.toYear })}
              </p>
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

export default HistoricalYearCompare;
