import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import UnifiedMapWrapper from '../map/UnifiedMapWrapper';
import { useAuthUser } from '../auth/auth';
import { OFFICER_ROLES } from '../officer/officerAuth';

type CombinedLayerKey = 'zoning' | 'restriction' | 'infrastructure' | 'changeDetection' | 'adminNotes';
const LAYER_KEYS: CombinedLayerKey[] = ['zoning', 'restriction', 'infrastructure', 'changeDetection', 'adminNotes'];

const ADMIN_COMBINED_VISIBLE_LAYERS = ['zoning', 'restriction', 'infrastructure', 'changeDetection', 'adminNotes', 'roads', 'buildings', 'landcover', 'elevation'] as const;

const AdminCombinedLayerMap: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  const userRole = user?.role ?? 'ADMIN';

  return (
    <div className="relative w-full border-2 sm:border-4 border-ink">
      <UnifiedMapWrapper
        parcels={[]}
        showClusterDropdown={false}
        showLayerPanel={true}
        userRole={userRole}
        visibleLayerKeys={[...ADMIN_COMBINED_VISIBLE_LAYERS]}
        showYearSelector={false}
        height="h-[500px]"
        className="border-0"
      />
      <div className="absolute bottom-2 left-2 bg-surface border-2 border-ink shadow-hard-sm p-2.5 text-xs max-w-[190px]">
        <p className="mb-1.5 font-black uppercase tracking-widest text-[10px] text-ink border-b-2 border-ink/15 pb-1">
          {t('adminPortal.combinedMapLayersHeading')}
        </p>
        {LAYER_KEYS.map((key) => (
          <span key={key} className="flex items-center gap-1.5 py-0.5 text-ink/80 font-medium">
            <span className="w-3.5 h-3.5 border border-ink shrink-0" aria-hidden="true" />
            {t(`adminPortal.combinedMapLayer.${key}`)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default AdminCombinedLayerMap;