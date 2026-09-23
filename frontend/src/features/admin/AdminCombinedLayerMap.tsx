import React from 'react';
import UnifiedMapWrapper from '../map/UnifiedMapWrapper';
import { useAuthUser } from '../auth/auth';

const ADMIN_COMBINED_VISIBLE_LAYERS = ['zoning', 'restriction', 'infrastructure', 'changeDetection', 'adminNotes', 'roads', 'buildings', 'landcover', 'elevation'] as const;

const AdminCombinedLayerMap: React.FC = () => {
  const { data: user } = useAuthUser();
  const userRole = user?.role ?? 'ADMIN';

  return (
    // overflow-hidden clips MapLibre's canvas/controls to the card; the padding
    // frame makes the card visibly larger than the map it holds.
    <div className="relative w-full border-2 sm:border-4 border-ink overflow-hidden bg-surface p-2 sm:p-3">
      <UnifiedMapWrapper
        parcels={[]}
        showClusterDropdown={false}
        showLayerPanel={true}
        userRole={userRole}
        visibleLayerKeys={[...ADMIN_COMBINED_VISIBLE_LAYERS]}
        initialLayersOn={['roads', 'buildings']}
        fetchOverlaysNationwide
        showYearSelector={false}
        height="h-[60vh] min-h-[420px]"
        className="border-2 border-ink"
      />
    </div>
  );
};

export default AdminCombinedLayerMap;