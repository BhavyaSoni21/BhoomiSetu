import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Map, Mountain, Layers, Calendar } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import MapComponent from './MapComponent';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';

interface HierarchicalCluster {
  stateCode: string;
  districts: Array<{
    districtCode: string;
    clusters: Array<{
      clusterId: string;
      bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number };
    }>;
  }>;
}

interface UnifiedMapWrapperProps {
  /** When provided, render exactly these parcels instead of fetching all of them. */
  parcels?: ParcelSummary[];
  /** Parcel id to highlight and load spatial context for. */
  selectedParcelId?: string | null;
  /** Called when a parcel polygon is clicked. */
  onParcelClick?: (parcelId: string) => void;
  /** Per-parcel fill color override. */
  parcelColors?: Record<string, string>;
  /** Per-parcel extra popup line. */
  parcelLabels?: Record<string, string>;
  /** Zoom/pan to fit the parcels prop's bounds once they load. */
  fitToParcels?: boolean;
  /** Which legend checkboxes to render. */
  visibleLayerKeys?: Array<
    | 'selected'
    | 'adjacent'
    | 'nearby'
    | 'cluster'
    | 'sameDistrict'
    | 'zoning'
    | 'restriction'
    | 'infrastructure'
    | 'changeDetection'
  >;
  /** Hide the bottom-left layer-toggle legend entirely. */
  showLayerPanel?: boolean;
  /** Bump to re-fit the map to the selected parcel's cluster/context on demand. */
  recenterSignal?: number;
  /** Pan/zoom to these bounds (e.g. a cluster picked from dropdown). */
  focusBounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  /** Show historical year selector (officer/admin only). */
  showYearSelector?: boolean;
  /** Available years for historical imagery (from cluster data). */
  historicalYears?: number[];
  /** Currently selected historical year. */
  selectedYear?: number;
  /** Callback when historical year changes. */
  onYearChange?: (year: number) => void;
  /** Show the hierarchical cluster dropdown. */
  showClusterDropdown?: boolean;
  /** Cluster ID for historical imagery (Parcel 360). */
  clusterId?: string;
  /** Years available for this cluster. */
  years?: number[];
  /** Current user role for permission checks. */
  userRole?: string;
  /** Extra action rendered inline (e.g. Parcel 360's "Locate" button). */
  actionSlot?: React.ReactNode;
  /** Custom className for the wrapper. */
  className?: string;
  /** Map height override. */
  height?: string;
}

const OFFICER_ROLES = ['OFFICER', 'ADMIN', 'VERIFIER', 'CHECKER', 'APPROVER'] as const;

const UnifiedMapWrapper: React.FC<UnifiedMapWrapperProps> = ({
  parcels: parcelsProp,
  selectedParcelId,
  onParcelClick,
  parcelColors,
  parcelLabels,
  fitToParcels,
  visibleLayerKeys,
  showLayerPanel = true,
  recenterSignal,
  focusBounds,
  showYearSelector = false,
  historicalYears = [],
  selectedYear,
  onYearChange,
  showClusterDropdown = false,
  clusterId,
  years,
  userRole,
  actionSlot,
  className = '',
  height = 'h-[500px]',
}) => {
  const { t } = useTranslation();
  const isOfficerOrAdmin = userRole ? OFFICER_ROLES.includes(userRole as (typeof OFFICER_ROLES)[number]) : false;

  // Use years from props (Parcel 360) or historicalYears (other maps)
  const effectiveHistoricalYears = years?.length ? years : historicalYears;

  // Fetch hierarchical clusters for the dropdown
  const { data: hierarchicalClusters = [], isLoading: clustersLoading } = useQuery<HierarchicalCluster[]>(
    ['gis-clusters-hierarchical'],
    async () => {
      const response = await apiService.get('/gis/clusters-hierarchical');
      return response.data;
    },
    { staleTime: 1000 * 60 * 30 }, // 30 minutes - clusters rarely change
  );

  // State for hierarchical dropdown
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [clusterBounds, setClusterBounds] = useState<{ minLng: number; minLat: number; maxLng: number; maxLat: number } | null>(null);

  // Find cluster bounds when selection changes
  useEffect(() => {
    if (!selectedCluster) {
      setClusterBounds(null);
      return;
    }
    for (const state of hierarchicalClusters) {
      if (state.stateCode !== selectedState) continue;
      for (const district of state.districts) {
        if (district.districtCode !== selectedDistrict) continue;
        for (const cluster of district.clusters) {
          if (cluster.clusterId === selectedCluster) {
            setClusterBounds(cluster.bounds);
            return;
          }
        }
      }
    }
  }, [selectedState, selectedDistrict, selectedCluster, hierarchicalClusters]);

  // Reset district/cluster when state changes
  useEffect(() => {
    setSelectedDistrict('');
    setSelectedCluster('');
  }, [selectedState]);

  // Reset cluster when district changes
  useEffect(() => {
    setSelectedCluster('');
  }, [selectedDistrict]);

  // Use cluster bounds from dropdown if no explicit focusBounds provided
  const effectiveFocusBounds = focusBounds ?? clusterBounds;

  // Locate button handler - bumps recenterSignal to re-trigger map fit
  const [internalRecenterSignal, setInternalRecenterSignal] = useState(0);
  const handleLocate = () => {
    setInternalRecenterSignal((n) => n + 1);
  };

  // Combined recenter signal (external + internal)
  const combinedRecenterSignal = (recenterSignal ?? 0) + internalRecenterSignal;

  // Determine available districts for selected state
  const availableDistricts = selectedState
    ? hierarchicalClusters.find((s) => s.stateCode === selectedState)?.districts ?? []
    : [];

  // Determine available clusters for selected district
  const availableClusters = selectedDistrict
    ? availableDistricts.find((d) => d.districtCode === selectedDistrict)?.clusters ?? []
    : [];

  return (
    <div className={`relative ${height} w-full ${className}`}>
      {/* Top controls: Hierarchical dropdown + Year selector + Locate button */}
      {(showClusterDropdown || showYearSelector) && (
        <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-center justify-between gap-2 bg-surface/95 backdrop-blur-sm border-2 border-ink shadow-hard-sm p-2">
          {/* Hierarchical State → District → Cluster Dropdown */}
          {showClusterDropdown && hierarchicalClusters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="unified-map-state-select" className="text-[10px] font-bold uppercase tracking-widest text-ink/60 hidden sm:block">
                {t('unifiedMap.state')}
              </label>
              <select
                id="unified-map-state-select"
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full sm:w-auto min-w-[140px] border-2 border-ink bg-surface px-2 py-1.5 text-sm font-semibold text-ink"
                aria-label={t('unifiedMap.stateAria')}
              >
                <option value="">{t('unifiedMap.selectState')}</option>
                {hierarchicalClusters.map((state) => (
                  <option key={state.stateCode} value={state.stateCode}>
                    {state.stateCode}
                  </option>
                ))}
              </select>

              {selectedState && (
                <>
                  <label htmlFor="unified-map-district-select" className="text-[10px] font-bold uppercase tracking-widest text-ink/60 hidden sm:block">
                    {t('unifiedMap.district')}
                  </label>
                  <select
                    id="unified-map-district-select"
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full sm:w-auto min-w-[140px] border-2 border-ink bg-surface px-2 py-1.5 text-sm font-semibold text-ink"
                    aria-label={t('unifiedMap.districtAria')}
                  >
                    <option value="">{t('unifiedMap.selectDistrict')}</option>
                    {availableDistricts.map((district) => (
                      <option key={district.districtCode} value={district.districtCode}>
                        {district.districtCode}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {selectedDistrict && (
                <>
                  <label htmlFor="unified-map-cluster-select" className="text-[10px] font-bold uppercase tracking-widest text-ink/60 hidden sm:block">
                    {t('unifiedMap.cluster')}
                  </label>
                  <select
                    id="unified-map-cluster-select"
                    value={selectedCluster}
                    onChange={(e) => setSelectedCluster(e.target.value)}
                    className="w-full sm:w-auto min-w-[140px] border-2 border-ink bg-surface px-2 py-1.5 text-sm font-semibold text-ink"
                    aria-label={t('unifiedMap.clusterAria')}
                  >
                    <option value="">{t('unifiedMap.selectCluster')}</option>
                    {availableClusters.map((cluster) => (
                      <option key={cluster.clusterId} value={cluster.clusterId}>
                        {cluster.clusterId}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}

          {/* Year Selector (Officer/Admin only) */}
          {showYearSelector && isOfficerOrAdmin && effectiveHistoricalYears.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="unified-map-year-select" className="text-[10px] font-bold uppercase tracking-widest text-ink/60 hidden sm:block">
                {t('unifiedMap.year')}
              </label>
              <select
                id="unified-map-year-select"
                value={selectedYear ?? effectiveHistoricalYears[effectiveHistoricalYears.length - 1]}
                onChange={(e) => onYearChange?.(Number(e.target.value))}
                className="w-full sm:w-auto min-w-[100px] border-2 border-ink bg-surface px-2 py-1.5 text-sm font-bold text-ink"
                aria-label={t('unifiedMap.yearAria')}
              >
                {effectiveHistoricalYears
                  .slice()
                  .sort((a, b) => b - a)
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Locate Button + Action Slot */}
          <div className="flex items-center gap-2">
            {actionSlot}
            <button
              type="button"
              onClick={handleLocate}
              className="inline-flex items-center gap-1.5 border-2 border-ink bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] shrink-0"
              aria-label={t('unifiedMap.locateAria')}
              title={t('unifiedMap.locateTooltip')}
            >
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('unifiedMap.locate')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Map Component */}
      <div className="absolute inset-0">
        <MapComponent
          parcels={parcelsProp}
          selectedParcelId={selectedParcelId}
          onParcelClick={onParcelClick}
          parcelColors={parcelColors}
          parcelLabels={parcelLabels}
          fitToParcels={fitToParcels}
          visibleLayerKeys={visibleLayerKeys}
          showLayerPanel={showLayerPanel}
          recenterSignal={combinedRecenterSignal}
          focusBounds={effectiveFocusBounds}
        />
      </div>

      {/* Cluster lock indicator */}
      {effectiveFocusBounds && (
        <div className="absolute bottom-2 right-2 z-10 bg-surface/90 backdrop-blur-sm border-2 border-ink shadow-hard-sm px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-ink/70">
          {t('unifiedMap.clusterLocked')}
        </div>
      )}

      {clustersLoading && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide">
          {t('unifiedMap.loadingClusters')}
        </div>
      )}
    </div>
  );
};

export default UnifiedMapWrapper;