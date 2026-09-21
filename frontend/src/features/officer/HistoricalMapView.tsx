import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useHistoricalClusters } from './historicalImagery';
import UnifiedMapWrapper from '../map/UnifiedMapWrapper';
import { useCategorizedParcels } from './historicalImagery';
import { ParcelCategory } from '../../types/historicalImagery';
import { ParcelSummary } from '../../types/parcel';
import { OFFICER_ROLES } from './officerAuth';
import { useAuthUser } from '../auth/auth';
import apiService from '../../services/apiService';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Satellite } from 'lucide-react';

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
const HistoricalMapView: React.FC<HistoricalMapViewProps> = ({
  clusterId,
  years,
  selectedParcelId,
  onParcelClick,
  recenterSignal,
}) => {
  const { t } = useTranslation();
  const [year, setYear] = useState<number>(years[years.length - 1]);
  useEffect(() => {
    if (!years.includes(year)) setYear(years[years.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId, years]);

  const { data: categorizedParcels = [], isLoading, error } = useCategorizedParcels(clusterId, year);

  // Real satellite photo view - officer-only (per the user's explicit "at
  // least the officers"), fetched on demand rather than automatically on
  // every year/cluster change to avoid burning Earth Engine quota on views
  // nobody asked to see.
  const { data: user } = useAuthUser();
  const isOfficer = OFFICER_ROLES.includes(user?.role as (typeof OFFICER_ROLES)[number]);
  const [viewMode, setViewMode] = useState<'map' | 'satellite'>('map');
  const objectUrlRef = useRef<string | null>(null);
  const [satelliteImageUrl, setSatelliteImageUrl] = useState<string | null>(null);

  const satelliteQuery = useQuery(
    ['cluster-satellite-image', clusterId, year],
    async () => {
      const response = await apiService.get(`/change-detection/clusters/${clusterId}/satellite-image`, {
        params: { date: `${year}-01-01` },
        responseType: 'blob',
        timeout: 60000,
      });
      return response.data as Blob;
    },
    {
      enabled: false,
      onSuccess: (blob) => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setSatelliteImageUrl(url);
      },
    },
  );

  useEffect(() => {
    setSatelliteImageUrl(null);
  }, [clusterId, year]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

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

  // Custom layer panel content for historical imagery (category legend)
  const showCustomLayerPanel = true;
  const customLayerContent = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold uppercase tracking-widest text-ink/60">
      {SNAPSHOT_LEGEND.map((entry) => (
        <span key={entry.category} className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 border border-ink/30 shrink-0" style={{ backgroundColor: entry.color }} aria-hidden="true" />
          {entry.label}
        </span>
      ))}
      <span className="normal-case font-normal text-ink/40">(disputes only ever appear on the current year)</span>
    </div>
  );

  // View mode toggle (Map / Satellite) - officer only
  const actionSlot = isOfficer ? (
    <div className="flex items-center gap-3">
      <div className="flex items-center border-2 border-ink">
        <button
          type="button"
          onClick={() => setViewMode('map')}
          className={`px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${viewMode === 'map' ? 'bg-primary text-white' : 'bg-surface text-ink'}`}
        >
          Parcel Map
        </button>
        <button
          type="button"
          onClick={() => setViewMode('satellite')}
          className={`px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide border-l-2 border-ink ${viewMode === 'satellite' ? 'bg-primary text-white' : 'bg-surface text-ink'}`}
        >
          Satellite Photo
        </button>
      </div>
      {viewMode === 'satellite' && !satelliteImageUrl && (
        <button
          type="button"
          onClick={() => satelliteQuery.refetch()}
          disabled={satelliteQuery.isFetching}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-ink bg-secondary text-white text-[11px] font-bold uppercase tracking-wide disabled:opacity-50"
        >
          {satelliteQuery.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Satellite className="w-3.5 h-3.5" aria-hidden="true" />}
          {satelliteQuery.isFetching ? 'Loading...' : `Load ${year} satellite photo`}
        </button>
      )}
    </div>
  ) : undefined;

  const satelliteOverlay = viewMode === 'satellite' && isOfficer ? (
    <>
      {satelliteImageUrl ? (
        <img
          src={satelliteImageUrl}
          alt={`Satellite photo of cluster ${clusterId} near ${year}`}
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-ink/40 text-sm font-bold uppercase tracking-wide text-center px-4">
          {satelliteQuery.isError ? (
            <span className="text-secondary-strong normal-case font-medium">
              Could not load a real satellite photo for this area/date - it may not have cloud-free coverage.
            </span>
          ) : (
            <span>Click "Load {year} satellite photo" above</span>
          )}
        </div>
      )}
    </>
  ) : undefined;

  return (
    <div className="border-2 sm:border-4 border-ink">
      <UnifiedMapWrapper
        parcels={parcels}
        parcelColors={parcelColors}
        parcelLabels={parcelLabels}
        selectedParcelId={selectedParcelId}
        onParcelClick={onParcelClick}
        recenterSignal={recenterSignal}
        fitToParcels={true}
        showClusterDropdown={false}
        showYearSelector
        historicalYears={years}
        selectedYear={year}
        onYearChange={setYear}
        showLayerPanel={showCustomLayerPanel}
        visibleLayerKeys={['cluster', 'zoning', 'restriction', 'infrastructure', 'changeDetection']}
        userRole={user?.role}
        actionSlot={actionSlot}
        height="h-[500px]"
        focusBounds={null}
        overlayElement={satelliteOverlay}
      />
    </div>
  );
};

export default HistoricalMapView;