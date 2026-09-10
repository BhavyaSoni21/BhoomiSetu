import React, { useEffect, useState } from 'react';
import { useCategorizedParcels } from './historicalImagery';
import { ParcelCategory } from '../../types/historicalImagery';
import { ParcelSummary } from '../../types/parcel';
import MapComponent from '../map/MapComponent';

// Mirrors backend/src/common/parcel-generation/parcel-category.ts's
// CATEGORY_COLORS/CATEGORY_LABELS - duplicated rather than shared, matching
// this codebase's existing convention for enum-like constants across the
// backend/frontend boundary (see backend/src/auth/roles.constants.ts).
// Exported so HistoricalImageryPanel's compare-results list uses the exact
// same colors/labels as the map above it.
export const CATEGORY_COLORS: Record<ParcelCategory, string> = {
  NONE: '#8fae86',
  RESTRICTED: '#3f6fb3',
  DISPUTE_OWNERSHIP: '#6b4c9a',
  DISPUTE_BOUNDARY: '#c9702e',
  DISPUTE_INHERITANCE: '#c9a227',
  DISPUTE_ENCROACHMENT: '#b33f3f',
};

export const CATEGORY_LABELS: Record<ParcelCategory, string> = {
  NONE: 'Clear',
  RESTRICTED: 'Restricted zone',
  DISPUTE_OWNERSHIP: 'Ownership dispute',
  DISPUTE_BOUNDARY: 'Boundary dispute',
  DISPUTE_INHERITANCE: 'Inheritance dispute',
  DISPUTE_ENCROACHMENT: 'Encroachment dispute',
};

const SNAPSHOT_LEGEND = (Object.keys(CATEGORY_LABELS) as ParcelCategory[]).map((category) => ({
  category,
  color: CATEGORY_COLORS[category],
  label: CATEGORY_LABELS[category],
}));

export const CategorySwatch: React.FC<{ category: ParcelCategory }> = ({ category }) => (
  <span
    className="inline-block w-2.5 h-2.5 rounded-full border border-ink/30 shrink-0"
    style={{ backgroundColor: CATEGORY_COLORS[category] }}
    aria-hidden="true"
  />
);

interface HistoricalMapViewProps {
  clusterId: string;
  years: number[];
  /** Parcel id to highlight (blue outline) and load spatial context (adjacent/nearby/same-district) for - passed straight through to MapComponent. Optional: the Officer Portal's standalone Historical Imagery page has no single parcel in focus. */
  selectedParcelId?: string | null;
  /** Called when any parcel on the map is clicked, in addition to the highlight above - Parcel 360 uses this to navigate to the clicked parcel. */
  onParcelClick?: (parcelId: string) => void;
  /** Extra action rendered inline to the right of the year select (e.g. Parcel 360's "Locate" button) - optional, so the Officer Portal's standalone Historical Imagery page (which passes nothing here) is unaffected. */
  actionSlot?: React.ReactNode;
  /** Passed straight through to MapComponent - bump to re-fit the map to selectedParcelId's context on demand (Parcel 360's "Locate" button). */
  recenterSignal?: number;
}

// The real, interactive map for one chosen year - a cluster's actual parcel
// boundaries (not the flat SVG-rendered snapshot PNG) colored by each
// parcel's real ParcelCategory for that year, with a year dropdown above it.
// Shared between the Officer Portal's Historical Imagery page (no
// selectedParcelId) and Parcel 360's single combined map (both officer- and
// citizen-facing, with selectedParcelId/onParcelClick wired through so this
// one map also highlights the current parcel and supports click-to-navigate)
// - GET .../clusters and .../years/:year/parcels are public (2026-09-08) for
// exactly this reason. `fitToParcels` on MapComponent zooms to the cluster's
// own bounds up front; if selectedParcelId is also given, MapComponent's own
// contextual zoom takes over once that parcel's context loads.
const HistoricalMapView: React.FC<HistoricalMapViewProps> = ({ clusterId, years, selectedParcelId, onParcelClick, actionSlot, recenterSignal }) => {
  const [year, setYear] = useState<number>(years[years.length - 1]);
  useEffect(() => {
    if (!years.includes(year)) setYear(years[years.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId, years]);

  const { data: categorizedParcels = [], isLoading, error } = useCategorizedParcels(clusterId, year);

  const parcels: ParcelSummary[] = categorizedParcels.map((p) => ({
    id: p.id,
    canonicalParcelId: p.canonicalParcelId,
    ulpin: p.ulpin,
    stateCode: p.stateCode,
    districtCode: p.districtCode,
    localBodyCode: p.localBodyCode,
    areaSqM: p.areaSqM,
    geometry: p.geometry,
  }));
  const parcelColors = Object.fromEntries(categorizedParcels.map((p) => [p.id, CATEGORY_COLORS[p.category]]));
  const parcelLabels = Object.fromEntries(categorizedParcels.map((p) => [p.id, CATEGORY_LABELS[p.category]]));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-3">
        {SNAPSHOT_LEGEND.map((entry) => (
          <span key={entry.category} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 border border-ink/30 shrink-0" style={{ backgroundColor: entry.color }} aria-hidden="true" />
            {entry.label}
          </span>
        ))}
        <span className="normal-case font-normal text-ink/40">(disputes only ever appear on the current year)</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <label htmlFor={`historical-map-year-select-${clusterId}`} className="block text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1.5">
            Map year
          </label>
          <select
            id={`historical-map-year-select-${clusterId}`}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="w-full sm:w-auto border-2 border-ink bg-surface px-3 py-2 text-sm font-bold text-ink"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {actionSlot}
      </div>

      {Boolean(error) && <p className="text-xs font-medium text-secondary-strong mb-2">Could not load this year's parcel data.</p>}
      {!error &&
        (isLoading ? (
          <div className="h-[500px] w-full border-2 sm:border-4 border-ink flex items-center justify-center text-ink/40 text-sm font-bold uppercase tracking-wide">
            Loading {year}...
          </div>
        ) : (
          <MapComponent
            parcels={parcels}
            parcelColors={parcelColors}
            parcelLabels={parcelLabels}
            fitToParcels
            selectedParcelId={selectedParcelId}
            onParcelClick={onParcelClick}
            recenterSignal={recenterSignal}
          />
        ))}
    </div>
  );
};

export default HistoricalMapView;
