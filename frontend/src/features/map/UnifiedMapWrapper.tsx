import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Map, Mountain, Layers as LayersIcon, Calendar, Filter, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import MapComponent, { type LayerKey } from './MapComponent';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import { STATES_AND_DISTRICTS, StateData, District } from '../../data/locationData';
import { SpatialFeatureCollection } from '../../types/spatial';

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
    | 'adminNotes'
    | 'roads'
    | 'buildings'
    | 'landcover'
    | 'elevation'
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
  /** Hide the state dropdown in the cluster selector (when parent has its own state picker). */
  hideStateDropdown?: boolean;
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
  /** Fixed height class (e.g. h-[500px] or h-full) */
  height?: string;
  /** Optional overlay element to render completely over the map area (e.g. for full-bleed satellite photos). */
  overlayElement?: React.ReactNode;
}

const LAYER_KEYS: LayerKey[] = [
  'selected',
  'adjacent',
  'nearby',
  'cluster',
  'sameDistrict',
  'zoning',
  'restriction',
  'infrastructure',
  'changeDetection',
  'adminNotes',
  'roads',
  'buildings',
  'landcover',
  'elevation',
];

const LAYER_LABELS: Record<LayerKey, string> = {
  selected: 'Selected Parcel',
  adjacent: 'Adjacent Parcels',
  nearby: 'Nearby Parcels',
  cluster: 'Full Cluster',
  sameDistrict: 'Same District',
  zoning: 'Zoning',
  restriction: 'Restriction Zones',
  infrastructure: 'Infrastructure',
  changeDetection: 'Change Detection',
  adminNotes: 'Admin Notes',
  roads: 'Roads (OSM)',
  buildings: 'Buildings (MS)',
  landcover: 'Land Cover',
  elevation: 'Elevation',
};

const OFFICER_ROLES = ['OFFICER', 'ADMIN', 'VERIFIER', 'CHECKER', 'APPROVER'] as const;

const EMPTY_FC: SpatialFeatureCollection = { type: 'FeatureCollection', features: [] };

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
  hideStateDropdown = false,
  clusterId,
  years,
  userRole,
  actionSlot,
  className = '',
  height = 'h-[500px]',
  overlayElement,
}) => {
  const { t } = useTranslation();
  const isOfficerOrAdmin = userRole ? OFFICER_ROLES.includes(userRole as (typeof OFFICER_ROLES)[number]) : false;
  // GET /gis/admin-notes is require_roles("ADMIN") server-side, so fetching it
  // as anyone else just 403s and spams the console. Only ask for it as admin.
  const isAdmin = userRole === 'ADMIN';

  // Use years from props (Parcel 360) or historicalYears (other maps)
  const effectiveHistoricalYears = years?.length ? years : historicalYears;

  // Layer filter state
  const [layerVisibility, setLayerVisibility] = useState<Record<LayerKey, boolean>>(
    LAYER_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<LayerKey, boolean>)
  );
  const [showLayerFilters, setShowLayerFilters] = useState(false);
  const layerFiltersRef = useRef<HTMLDivElement>(null);

  const toggleLayer = (key: LayerKey) => setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  // Close layer filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (layerFiltersRef.current && !layerFiltersRef.current.contains(event.target as Node)) {
        setShowLayerFilters(false);
      }
    };
    if (showLayerFilters) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLayerFilters]);

  // State for hierarchical dropdown
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [clusterBounds, setClusterBounds] = useState<{ minLng: number; minLat: number; maxLng: number; maxLat: number } | null>(null);

  // Fetch hierarchical clusters for the dropdown
  const { data: hierarchicalClusters = [], isLoading: clustersLoading } = useQuery<HierarchicalCluster[]>(
    ['gis-clusters-hierarchical'],
    async () => {
      const response = await apiService.get('/gis/clusters-hierarchical');
      return response.data;
    },
    { staleTime: 1000 * 60 * 30 }, // 30 minutes - clusters rarely change
  );

  // Flatten clusters into low-zoom overview markers (centroid of each
  // cluster's bounds). Only meaningful in the "show all" mode - when a
  // caller hands us its own `parcels`, it already knows what to show.
  const clusterOverviewFC = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: hierarchicalClusters.flatMap((state) =>
      state.districts.flatMap((district) =>
        district.clusters.map((c) => ({
          type: 'Feature' as const,
          properties: {
            clusterId: c.clusterId,
            label: c.clusterId,
            minLng: c.bounds.minLng, minLat: c.bounds.minLat,
            maxLng: c.bounds.maxLng, maxLat: c.bounds.maxLat,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [(c.bounds.minLng + c.bounds.maxLng) / 2, (c.bounds.minLat + c.bounds.maxLat) / 2],
          },
        })),
      ),
    ),
  }), [hierarchicalClusters]);

  // Determine district context for spatial layer availability checks
  // Uses selected parcel's district, or first parcel's district from props
  const districtContext = useMemo(() => {
    // TODO: This would need the selected parcel's context to get district
    // For now, we'll check from parcels prop if available
    if (parcelsProp && parcelsProp.length > 0) {
      return { state: parcelsProp[0].stateCode, district: parcelsProp[0].districtCode };
    }
    return null;
  }, [parcelsProp]);

  // Check which spatial layers have data in the database for this district
  const { data: zoningFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(
    ['zoning-overlays', districtContext?.state, districtContext?.district],
    async () => {
      const response = await apiService.get('/gis/zoning-overlays', { params: { state: districtContext!.state, district: districtContext!.district } });
      return response.data;
    },
    { enabled: !!districtContext }
  );

  const { data: restrictionFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(
    ['restriction-zones', districtContext?.state, districtContext?.district],
    async () => {
      const response = await apiService.get('/gis/restriction-zones', { params: { state: districtContext!.state, district: districtContext!.district } });
      return response.data;
    },
    { enabled: !!districtContext }
  );

  const { data: infrastructureFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(
    ['infrastructure', districtContext?.state, districtContext?.district],
    async () => {
      const response = await apiService.get('/gis/infrastructure', { params: { state: districtContext!.state, district: districtContext!.district } });
      return response.data;
    },
    { enabled: !!districtContext }
  );

  const { data: changeDetectionFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(
    ['change-detection-events', districtContext?.state, districtContext?.district],
    async () => {
      const response = await apiService.get('/gis/change-detection-events', { params: { state: districtContext!.state, district: districtContext!.district } });
      return response.data;
    },
    { enabled: !!districtContext }
  );

  // Admin-only notes layer - fetched without district scoping (all notes nationwide)
  const { data: adminNotesFC = EMPTY_FC } = useQuery<SpatialFeatureCollection>(
    ['admin-notes'],
    async () => {
      const response = await apiService.get('/gis/admin-notes');
      return response.data;
    },
    { enabled: (districtContext !== null || !!parcelsProp) && isAdmin }
  );

  // Determine which layers actually have data
  const layerHasData = useMemo<Record<LayerKey, boolean>>(() => ({
    zoning: zoningFC.features.length > 0,
    restriction: restrictionFC.features.length > 0,
    infrastructure: infrastructureFC.features.length > 0,
    changeDetection: changeDetectionFC.features.length > 0,
    adminNotes: adminNotesFC.features.length > 0,
    sameDistrict: parcelsProp !== undefined && districtContext !== null,
    cluster: !!selectedParcelId || !!focusBounds || !!selectedCluster,
    selected: !!selectedParcelId,
    adjacent: !!selectedParcelId,
    nearby: !!selectedParcelId,
    roads: true, // Vector tiles - always available if data exists in DB
    buildings: true,
    landcover: true,
    elevation: true,
  }), [zoningFC, restrictionFC, infrastructureFC, changeDetectionFC, adminNotesFC, parcelsProp, districtContext, selectedParcelId, focusBounds, selectedCluster]);

  // Build state/district lookup from locationData for full names
  const getStateName = (stateCode: string) => {
    const state = STATES_AND_DISTRICTS.find(s => s.code === stateCode);
    return state ? state.name : stateCode;
  };

  const getDistrictName = (stateCode: string, districtCode: string) => {
    const state = STATES_AND_DISTRICTS.find(s => s.code === stateCode);
    if (!state) return districtCode;
    const district = state.districts.find(d => d.code === districtCode);
    return district ? district.name : districtCode;
  };

  // Context-aware layer keys: only show layers relevant to current selection/focus AND that have data
  const effectiveLayerKeys = useMemo(() => {
    const baseKeys = visibleLayerKeys ?? LAYER_KEYS;
    const hasParcelSelected = !!selectedParcelId;
    const hasClusterFocus = !!focusBounds || !!selectedCluster;
    const isOfficerOrAdminMap = isOfficerOrAdmin;

    let availableKeys: LayerKey[];
    
    if (hasParcelSelected) {
      // Parcel selected: all contextual layers available (including adminNotes for officers)
      availableKeys = baseKeys;
    } else if (hasClusterFocus) {
      // Cluster focused: cluster + district overlays + terrain layers (no parcel-specific layers)
      const keys = ['cluster', 'zoning', 'restriction', 'infrastructure', 'changeDetection', 'roads', 'buildings', 'landcover', 'elevation'];
      if (isOfficerOrAdminMap) keys.push('adminNotes');
      availableKeys = baseKeys.filter((key) => keys.includes(key));
    } else {
      // No selection: only district-level overlay layers + terrain layers
      const keys = ['zoning', 'restriction', 'infrastructure', 'changeDetection', 'roads', 'buildings', 'landcover', 'elevation'];
      if (isOfficerOrAdminMap) keys.push('adminNotes');
      availableKeys = baseKeys.filter((key) => keys.includes(key));
    }

    // Show every context-relevant layer as a toggle, even before its data
    // has loaded - hiding no-data layers made the filter panel look empty
    // and left users unable to see which layers exist. Overlay layers still
    // only render features once a parcel/district brings their data in.
    return availableKeys;
  }, [visibleLayerKeys, selectedParcelId, focusBounds, selectedCluster, isOfficerOrAdmin]);

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

  // Determine available districts for selected state (from API data)
  const availableDistricts = selectedState
    ? hierarchicalClusters.find((s) => s.stateCode === selectedState)?.districts ?? []
    : [];

  // Determine available clusters for selected district
  const availableClusters = selectedDistrict
    ? availableDistricts.find((d) => d.districtCode === selectedDistrict)?.clusters ?? []
    : [];

  return (
    <div className={`flex flex-col ${height} w-full ${className}`}>
      {/* Controls bar above map - layer filters + locate button */}
      {showLayerPanel && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-surface border-b-2 border-ink p-2 shrink-0">
          {/* Layer Filters Dropdown */}
          {effectiveLayerKeys.length > 0 && (
            <div className="relative" ref={layerFiltersRef}>
              <button
                type="button"
                onClick={() => setShowLayerFilters(!showLayerFilters)}
                className="inline-flex items-center gap-1.5 border-2 border-ink bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] shrink-0"
                aria-label={t('unifiedMap.layersAria')}
                title={t('unifiedMap.layersTooltip')}
              >
                <LayersIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('unifiedMap.layers')}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLayerFilters ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {showLayerFilters && (
                <div className="absolute left-0 top-full mt-1 z-30 bg-surface border-2 border-ink shadow-hard-sm p-2 min-w-[180px] max-h-[300px] overflow-y-auto">
                  <p className="mb-1.5 font-black uppercase tracking-widest text-[10px] text-ink border-b-2 border-ink/15 pb-1">
                    {t('unifiedMap.layerFilters')}
                  </p>
                  {effectiveLayerKeys.map((key) => (
                    <label key={key} className="flex items-center gap-1.5 py-1 text-ink/80 font-medium cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={layerVisibility[key]}
                        onChange={() => toggleLayer(key)}
                        className="accent-primary w-3.5 h-3.5 border-2 border-ink"
                      />
                      {LAYER_LABELS[key]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Year Selector (Officer/Admin only) + Locate Button + Action Slot */}
          <div className="flex items-center gap-2 shrink-0">
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

      {/* Map Component - fills remaining space */}
      <div className="flex-1 relative min-h-0">
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
          initialLayerVisibility={layerVisibility}
          onLayerVisibilityChange={setLayerVisibility}
          clusterOverview={clusterOverviewFC}
          canViewAdminNotes={isAdmin}
        />
        {overlayElement && (
          <div className="absolute inset-0 z-20 bg-surface">
            {overlayElement}
          </div>
        )}
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