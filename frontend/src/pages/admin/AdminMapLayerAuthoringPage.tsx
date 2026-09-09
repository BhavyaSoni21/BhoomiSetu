import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPinned, Shield, Zap, Lock } from 'lucide-react';
import CornerMarker from '../../features/admin/CornerMarker';
import MapLayerManagement, { LayerTypeConfig } from '../../features/admin/MapLayerManagement';

// Coming Soon #3 (docs/ADMIN_PANEL_ISSUES.md) - the backend's zoning/
// restriction/infrastructure create-edit-delete APIs already work
// (backend/src/spatial/spatial.controller.ts, ADMIN-only); there was just no
// screen to drive them. Tabbed the same way ProfilePage.tsx splits
// Account/Documents, since the layer types are structurally similar but not
// the same list. Admin Notes (added as a follow-up, per the user's explicit
// "a map layer that should be visible to admin only and editable by admin
// only") is a 4th, admin-only tab - its own endpoints are ADMIN-gated on
// reads too, and it's never fetched by the shared citizen/officer map
// (features/map/MapComponent.tsx).
const AdminMapLayerAuthoringPage: React.FC = () => {
  const { t } = useTranslation();

  // Built inside the component (not a module-level constant) so tabLabel/
  // typeFieldLabel/idsLabel/notesLabel can go through t() like everything
  // else on this page.
  const LAYER_CONFIGS: (LayerTypeConfig & { tabLabel: string; icon: typeof MapPinned })[] = [
    {
      key: 'zoning-overlays',
      endpoint: '/gis/zoning-overlays',
      tabLabel: t('adminPortal.zoningOverlaysTab'),
      icon: MapPinned,
      typeField: 'zoneType',
      typeFieldLabel: t('adminPortal.zoneTypeLabel'),
      typeOptions: ['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL'],
      idsField: 'parcelIds',
      idsLabel: t('adminPortal.parcelIdsLabel'),
      geometryTypes: ['Polygon'],
      geometryExample: '{"type":"Polygon","coordinates":[[[73.85,18.52],[73.86,18.52],[73.86,18.53],[73.85,18.53],[73.85,18.52]]]}',
    },
    {
      key: 'restriction-zones',
      endpoint: '/gis/restriction-zones',
      tabLabel: t('adminPortal.restrictionZonesTab'),
      icon: Shield,
      typeField: 'restrictionType',
      typeFieldLabel: t('adminPortal.restrictionTypeLabel'),
      typeOptions: ['FLOOD', 'ENVIRONMENTAL', 'PROTECTED_AREA'],
      idsField: 'affectedParcelIds',
      idsLabel: t('adminPortal.affectedParcelIdsLabel'),
      geometryTypes: ['Polygon'],
      geometryExample: '{"type":"Polygon","coordinates":[[[73.85,18.52],[73.86,18.52],[73.86,18.53],[73.85,18.53],[73.85,18.52]]]}',
    },
    {
      key: 'infrastructure',
      endpoint: '/gis/infrastructure',
      tabLabel: t('adminPortal.infrastructureTab'),
      icon: Zap,
      typeField: 'featureType',
      typeFieldLabel: t('adminPortal.featureTypeLabel'),
      typeOptions: ['ROAD', 'WATER_LINE', 'ELECTRICITY'],
      geometryTypes: ['Point', 'LineString'],
      geometryExample: '{"type":"LineString","coordinates":[[73.85,18.52],[73.86,18.53]]}',
    },
    {
      key: 'admin-notes',
      endpoint: '/gis/admin-notes',
      tabLabel: t('adminPortal.adminNotesTab'),
      icon: Lock,
      notesField: 'notes',
      notesLabel: t('adminPortal.adminNotesFieldLabel'),
      geometryTypes: ['Point', 'LineString', 'Polygon'],
      geometryExample: '{"type":"Point","coordinates":[73.85,18.52]}',
      adminOnly: true,
    },
  ];

  const [activeKey, setActiveKey] = useState(LAYER_CONFIGS[0].key);
  const activeConfig = LAYER_CONFIGS.find((c) => c.key === activeKey)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">{t('adminNav.mapLayerAuthoring')}</h1>
        <p className="text-ink/60 mt-1">
          {t('adminPortal.mapLayerAuthoringSubtitle')}
        </p>
      </div>

      <div className="border-b-2 border-ink/20">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label={t('adminPortal.mapLayerTypesAria')}>
          {LAYER_CONFIGS.map((config) => (
            <button
              key={config.key}
              onClick={() => setActiveKey(config.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                activeKey === config.key ? 'border-primary text-primary' : 'border-transparent text-ink/50 hover:border-ink/30 hover:text-ink'
              }`}
            >
              <config.icon className="w-3.5 h-3.5" aria-hidden="true" />
              {config.tabLabel}
            </button>
          ))}
        </nav>
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <MapLayerManagement key={activeConfig.key} config={activeConfig} />
      </div>
    </div>
  );
};

export default AdminMapLayerAuthoringPage;
