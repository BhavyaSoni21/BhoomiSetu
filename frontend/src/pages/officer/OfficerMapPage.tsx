import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { MapPinned, Layers, Compass, ShieldCheck } from 'lucide-react';
import UnifiedMapWrapper from '../../features/map/UnifiedMapWrapper';
import BackButton from '../../components/BackButton';
import { useAuthUser } from '../../features/auth/auth';

const OfficerMapPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: authUser } = useAuthUser();

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
        <UnifiedMapWrapper
          showClusterDropdown
          showYearSelector
          showLayerPanel
          userRole={authUser?.role}
          className="rounded-xl border border-gov-border"
          height="h-[500px]"
        />
      </div>
    </div>
  );
};

export default OfficerMapPage;