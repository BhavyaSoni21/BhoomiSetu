import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Map, Mountain, Layers as LayersIcon, Calendar, Filter, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import MapComponent, { type LayerKey, DEFAULT_LAYER_VISIBILITY } from './MapComponent';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import { STATES_AND_DISTRICTS, StateData, District } from '../../data/locationData';
import { SpatialFeatureCollection } from '../../types/spatial';
import OfflineAreaButton from '../../components/OfflineAreaButton';
import { useAuthUser } from '../auth/auth';
import { nearestCluster } from './nearestCluster';

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
  visibleLayerKeys?: LayerKey[];
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
  /** Show layer toggle buttons below the map for quicker access. */
  showLayerButtonsBelowMap?: boolean;
  /** Custom className for the wrapper. */
  className?: string;
  /** Fixed height class (e.g. h-[500px] or h-full) */
  height?: string;
  /** Optional overlay element to render completely over the map area (e.g. for full-bleed satellite photos). */
  overlayElement?: React.ReactNode;
  /** Layer keys to switch ON at first render (merged over DEFAULT_LAYER_VISIBILITY), e.g. roads/buildings on the admin authoring map. */
  initialLayersOn?: LayerKey[];
  /** Fetch GIS overlays nationwide (no state/district scoping) instead of scoping to a selected parcel's district — for nationwide authoring maps with no parcel selected. */
  fetchOverlaysNationwide?: boolean;
}

const LAYER_KEYS: LayerKey[] = [
  'selected',
  'adjacent',
  'nearby',
  'cluster',
  'sameDistrict',
  'zoning',
  'restriction',
  'taxStatus',
  'infrastructure',
  'changeDetection',
  'adminNotes',
  'roads',
  'buildings',
  'landcover',
  'elevation',
  'legalStatus',
  'circleRate',
  'riskScore',
  'mismatch',
  'unauthorized',
];

const LAYER_LABELS: Record<LayerKey, string> = {
  selected: 'Selected Parcel',
  adjacent: 'Adjacent Parcels',
  nearby: 'Nearby Parcels',
  cluster: 'Full Cluster',
  sameDistrict: 'Same District',
  zoning: 'Zoning',
  restriction: 'Restriction Zones',
  taxStatus: 'Property Tax Status',
  infrastructure: 'Infrastructure',
  changeDetection: 'Change Detection',
  adminNotes: 'Admin Notes',
  roads: 'Roads (OSM)',
  buildings: 'Buildings (MS)',
  landcover: 'Land Cover',
  elevation: 'Elevation',
  legalStatus: 'Legal Status (Dispute + Encumbrance)',
  circleRate: 'Circle Rate Heatmap',
  riskScore: 'Composite Risk Score (AI)',
  mismatch: 'Master Plan Mismatch',
  unauthorized: 'Unauthorized Construction',
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
  showLayerButtonsBelowMap = false,
  className = '',
  height = 'h-[500px]',
  overlayElement,
  initialLayersOn,
  fetchOverlaysNationwide = false,
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
    {
      ...DEFAULT_LAYER_VISIBILITY,
      taxStatus: userRole === 'TAX_OFFICER',
      ...Object.fromEntries((initialLayersOn ?? []).map((k) => [k, true])),
    }
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

  // Default the view to the cluster nearest the citizen's captured home coords
  // (onboarding geolocation): pre-selects state/district/cluster so the map
  // focuses there AND the dropdown search is pre-filtered to their region. One
  // shot, and only when the caller hasn't already scoped the map (explicit
  // focusBounds/parcels) and no cluster is picked yet. Officers/admins have no
  // home coords, so their maps are untouched.
  const { data: authUser } = useAuthUser();
  const appliedHomeDefault = useRef(false);
  useEffect(() => {
    if (appliedHomeDefault.current) return;
    if (focusBounds || parcelsProp || selectedCluster) return;
    if (!hierarchicalClusters.length) return;
    const lat = authUser?.homeLatitude;
    const lng = authUser?.homeLongitude;
    if (lat == null || lng == null) return;
    const match = nearestCluster(hierarchicalClusters, lat, lng);
    if (!match) return;
    appliedHomeDefault.current = true;
    setSelectedState(match.stateCode);
    setSelectedDistrict(match.districtCode);
    setSelectedCluster(match.clusterId);
    setClusterBounds(match.bounds);
  }, [authUser, hierarchicalClusters, focusBounds, parcelsProp, selectedCluster]);

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

  // Determine district context for spatial layer availability checks.
  // Priority: an explicit parcels prop (Parcel 360 etc.), else the cluster
  // the user picked from the dropdown (its state+district come straight from
  // the cascading selectors). Without this second case, picking a cluster
  // left districtContext null, so no per-district overlay (zoning/restriction/
  // infrastructure/change-detection) ever loaded for that cluster.
  const districtContext = useMemo(() => {
    if (parcelsProp && parcelsProp.length > 0) {
      return { state: parcelsProp[0].stateCode, district: parcelsProp[0].districtCode };
    }
    if (selectedCluster && selectedState && selectedDistrict) {
      return { state: selectedState, district: selectedDistrict };
    }
    return null;
  }, [parcelsProp, selectedCluster, selectedState, selectedDistrict]);

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
  const hasParcels = parcelsProp !== undefined || !!selectedParcelId || !!focusBounds || !!selectedCluster;
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
    // Parcel-attribute overlays (recolor/flag the parcels already on the map),
    // so they're available whenever any parcel is rendered.
    taxStatus: hasParcels,
    legalStatus: hasParcels,
    circleRate: hasParcels,
    riskScore: hasParcels,
    mismatch: hasParcels,
    unauthorized: hasParcels,
  }), [zoningFC, restrictionFC, infrastructureFC, changeDetectionFC, adminNotesFC, parcelsProp, districtContext, selectedParcelId, focusBounds, selectedCluster, hasParcels]);

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
      availableKeys = isOfficerOrAdminMap ? baseKeys : baseKeys.filter(k => k !== 'adminNotes');
    } else if (hasClusterFocus) {
      // Cluster focused: cluster + district overlays + terrain layers + legalStatus + circleRate
      const keys = ['cluster', 'zoning', 'restriction', 'taxStatus', 'infrastructure', 'changeDetection', 'roads', 'buildings', 'landcover', 'elevation', 'legalStatus', 'circleRate', 'riskScore', 'mismatch', 'unauthorized'];
      if (isOfficerOrAdminMap) keys.push('adminNotes');
      availableKeys = baseKeys.filter((key) => keys.includes(key));
    } else {
      // No selection: only district-level overlay layers + terrain layers + legalStatus + circleRate
      const keys = ['zoning', 'restriction', 'taxStatus', 'infrastructure', 'changeDetection', 'roads', 'buildings', 'landcover', 'elevation', 'legalStatus', 'circleRate', 'riskScore', 'mismatch', 'unauthorized'];
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
    <>
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
                <div className="absolute left-0 top-full mt-1 z-30 bg-surface border-2 border-ink shadow-hard-sm p-2 min-w-[220px] max-h-[350px] overflow-y-auto">
                  <p className="mb-1.5 font-black uppercase tracking-widest text-[10px] text-ink border-b-2 border-ink/15 pb-1">
                    {t('unifiedMap.layerFilters')}
                  </p>
                  {effectiveLayerKeys.filter(key => !['legalStatus', 'riskScore', 'circleRate', 'taxStatus'].includes(key)).map((key) => (
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
                  {layerVisibility.legalStatus && (
                    <div className="mt-2 pt-2 border-t border-ink/20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-ink/60 mb-1.5">
                        {t('map.layer.legalStatusLegend')}
                      </p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm border border-ink/30 flex-shrink-0" style={{ background: 'rgba(0,0,0,0)', outline: '1.5px solid #6b7280' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.legalStatus0')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#f59e0b', opacity: 0.85 }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.legalStatus1')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#f97316', opacity: 0.85 }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.legalStatus2')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#dc2626', opacity: 0.85 }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.legalStatus3')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {layerVisibility.circleRate && (
                    <div className="mt-2 pt-2 border-t border-ink/20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-ink/60 mb-1.5">
                        {t('map.layer.circleRateLegend')}
                      </p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm border border-ink/30 flex-shrink-0" style={{ background: '#ffffcc' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.circleRate1')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#a1dab4' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.circleRate2')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#41b6c4' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.circleRate3')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#2c7fb8' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.circleRate4')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#253494' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.circleRate5')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {layerVisibility.riskScore && (
                    <div className="mt-2 pt-2 border-t border-ink/20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-ink/60 mb-1.5">
                        {t('map.layer.riskScoreLegend')}
                      </p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#10b981' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.riskScoreLow')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#f59e0b' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.riskScoreMedium')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#f97316' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.riskScoreHigh')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: '#ef4444' }} />
                          <span className="text-[11px] text-ink/80">{t('map.layer.riskScoreCritical')}</span>
                        </div>
                      </div>
                    </div>
                  )}
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
            {effectiveFocusBounds && (
              <OfflineAreaButton
                bounds={effectiveFocusBounds}
                areaId={selectedCluster || `${effectiveFocusBounds.minLng.toFixed(3)},${effectiveFocusBounds.minLat.toFixed(3)}`}
                label={selectedCluster ? getDistrictName(selectedState, selectedDistrict) + ' · ' + selectedCluster : 'Map area'}
              />
            )}
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
          userRole={userRole}
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
          fetchOverlaysNationwide={fetchOverlaysNationwide}
        />
        {overlayElement && (
          <div className="absolute inset-0 z-20 bg-surface">
            {overlayElement}
          </div>
        )}
        {/* Floating Legends on map when layers are visible */}
        <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-2 max-w-[210px] pointer-events-none">
          {layerVisibility.taxStatus && (
            <div className="pointer-events-auto bg-surface/95 backdrop-blur-sm border-2 border-ink shadow-hard-sm p-2 text-xs">
              <p className="text-[9px] font-black uppercase tracking-widest text-ink/60 mb-1">
                {t('map.layer.taxStatus')} ({t('map.layer.taxStatusLegend')})
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#22c55e', opacity: 0.9 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.taxStatusPaid')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#eab308', opacity: 0.9 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.taxStatusPending')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#ef4444', opacity: 0.9 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.taxStatusDefaulter')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border border-ink/40 flex-shrink-0" style={{ background: '#9ca3af', opacity: 0.9 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.taxStatusUnknown')}</span>
                </div>
              </div>
            </div>
          )}
          {layerVisibility.legalStatus && (
            <div className="pointer-events-auto bg-surface/95 backdrop-blur-sm border-2 border-ink shadow-hard-sm p-2 text-xs">
              <p className="text-[9px] font-black uppercase tracking-widest text-ink/60 mb-1">
                {t('map.layer.legalStatus')} {t('map.layer.legalStatusLegend')}
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border border-ink/40 flex-shrink-0" style={{ background: 'rgba(0,0,0,0)', outline: '1.5px solid #6b7280' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.legalStatus0')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#f59e0b', opacity: 0.85 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.legalStatus1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#f97316', opacity: 0.85 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.legalStatus2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#dc2626', opacity: 0.85 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.legalStatus3')}</span>
                </div>
              </div>
            </div>
          )}
          {layerVisibility.circleRate && (
            <div className="pointer-events-auto bg-surface/95 backdrop-blur-sm border-2 border-ink shadow-hard-sm p-2 text-xs">
              <p className="text-[9px] font-black uppercase tracking-widest text-ink/60 mb-1">
                {t('map.layer.circleRate')} ({t('map.layer.circleRateLegend')})
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border border-ink/40 flex-shrink-0" style={{ background: '#ffffcc' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.circleRate1')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#a1dab4' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.circleRate2')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#41b6c4' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.circleRate3')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#2c7fb8' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.circleRate4')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#253494' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.circleRate5')}</span>
                </div>
              </div>
            </div>
          )}
          {layerVisibility.riskScore && (
            <div className="pointer-events-auto bg-surface/95 backdrop-blur-sm border-2 border-ink shadow-hard-sm p-2 text-xs">
              <p className="text-[9px] font-black uppercase tracking-widest text-ink/60 mb-1">
                {t('map.layer.riskScore')} ({t('map.layer.riskScoreLegend')})
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#10b981' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.riskScoreLow')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#f59e0b' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.riskScoreMedium')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#f97316' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.riskScoreHigh')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#ef4444' }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.riskScoreCritical')}</span>
                </div>
              </div>
            </div>
          )}
          {layerVisibility.mismatch && (
            <div className="pointer-events-auto bg-surface/95 backdrop-blur-sm border-2 border-ink shadow-hard-sm p-2 text-xs">
              <p className="text-[9px] font-black uppercase tracking-widest text-ink/60 mb-1">
                {t('map.layer.mismatch')}
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#c026d3', opacity: 0.85 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.mismatchLegend')}</span>
                </div>
              </div>
            </div>
          )}
          {layerVisibility.unauthorized && (
            <div className="pointer-events-auto bg-surface/95 backdrop-blur-sm border-2 border-ink shadow-hard-sm p-2 text-xs">
              <p className="text-[9px] font-black uppercase tracking-widest text-ink/60 mb-1">
                {t('map.layer.unauthorized')}
              </p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#e11d48', opacity: 0.85 }} />
                  <span className="text-[10px] text-ink/80">{t('map.layer.unauthorizedLegend')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
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

    {showLayerButtonsBelowMap && effectiveLayerKeys.length > 0 && (
      <div className="mt-4 bg-surface border-2 border-ink p-3 rounded">
        <p className="mb-2 font-black uppercase tracking-widest text-xs text-ink/70">
          {t('unifiedMap.quickToggles', 'Map Layers')}
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Legal Status', key: 'legalStatus', implemented: true },
            { label: 'Tax Status', key: 'taxStatus', implemented: true },
            { label: 'Risk Score', key: 'riskScore', implemented: true },
            { label: 'Circle Rate / Valuation', key: 'circleRate', implemented: true },
            { label: 'Master Plan Mismatch', key: 'mismatch', implemented: true },
            { label: 'Unauthorized Activity', key: 'unauthorized', implemented: true },
          ].map((toggle) => (
            <button
              key={toggle.key}
              type="button"
              onClick={() => {
                if (toggle.implemented) {
                  setLayerVisibility((prev) => {
                    const isCurrentlyOn = prev[toggle.key as LayerKey];
                    return {
                      ...prev,
                      legalStatus: false,
                      taxStatus: false,
                      riskScore: false,
                      circleRate: false,
                      mismatch: false,
                      unauthorized: false,
                      [toggle.key]: !isCurrentlyOn,
                    };
                  });
                }
              }}
              className={`px-3 py-1.5 text-xs font-bold tracking-wide border-2 transition-colors rounded ${
                !toggle.implemented
                  ? 'border-ink/20 bg-surface text-ink/40 cursor-not-allowed'
                  : layerVisibility[toggle.key as LayerKey]
                  ? 'border-ink bg-primary text-surface'
                  : 'border-ink bg-surface text-ink hover:bg-muted'
              }`}
              disabled={!toggle.implemented}
            >
              {toggle.label}
            </button>
          ))}
        </div>
      </div>
    )}
  </>
  );
};

export default UnifiedMapWrapper;