import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../context/LanguageContext';
import { MapPinned, Layers, Compass, ShieldCheck } from 'lucide-react';
import MapComponent from '../../features/map/MapComponent';
import BackButton from '../../components/BackButton';
import apiService from '../../services/apiService';
import { ClusterOption } from '../../types/changeDetection';

const OfficerMapPage: React.FC = () => {
  const { t } = useTranslation();

  // Loading every parcel nationwide (the map's default with no scoping)
  // is slow and mostly useless - an officer only ever needs one cluster
  // (city/village) at a time, so a cluster picker narrows both the
  // viewport and the parcels fetched into it (see MapComponent's
  // `focusBounds`).
  const { data: clusters = [] } = useQuery<ClusterOption[]>(['change-detection-clusters'], async () => {
    const response = await apiService.get('/change-detection/clusters');
    return response.data;
  });
  const [clusterId, setClusterId] = useState<string | null>(null);
  useEffect(() => {
    if (clusters.length > 0 && !clusters.some((c) => c.clusterId === clusterId)) {
      setClusterId(clusters[0].clusterId);
    }
  }, [clusters, clusterId]);
  const selectedCluster = clusters.find((c) => c.clusterId === clusterId) ?? null;

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4 text-action-600" />
            <span>Official Cadastral GIS · Jurisdiction Boundary Viewer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            {t('officerNav.map', 'State Cadastre Map View')}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Interactive GIS viewer with high-resolution parcel boundaries, dispute tags, and SVAMITVA drone ortho-imagery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-green-100 text-green-800 border border-green-200">
            PostGIS Live Sync
          </span>
        </div>
      </div>

      <div className="gov-card p-5 overflow-hidden space-y-3">
        <div>
          <label htmlFor="officer-map-cluster-select" className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
            Cluster (city/village)
          </label>
          <select
            id="officer-map-cluster-select"
            value={clusterId ?? ''}
            onChange={(event) => setClusterId(event.target.value)}
            className="w-full sm:w-auto border border-gov-border rounded-xl px-3 py-2 text-sm font-semibold bg-white"
          >
            {clusters.map((c) => (
              <option key={c.clusterId} value={c.clusterId}>
                {c.district} · {c.clusterId}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl overflow-hidden border border-gov-border">
          <MapComponent focusBounds={selectedCluster?.bounds ?? null} />
        </div>
      </div>
    </div>
  );
};

export default OfficerMapPage;
