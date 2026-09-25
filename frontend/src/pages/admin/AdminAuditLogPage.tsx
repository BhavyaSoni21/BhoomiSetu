import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { ScrollText } from 'lucide-react';
import RecentActivity from '../../features/admin/RecentActivity';
import CornerMarker from '../../features/admin/CornerMarker';
import BackButton from '../../components/BackButton';

// Dedicated Audit Log page. The PS (SIH26014) explicitly requires "audit
// trails"; the trail already exists as the filterable RecentActivity feed
// (GET /audit), previously only reachable inside System Monitoring. This is a
// thin, clearly-labelled home for it - reuses RecentActivity verbatim, no new
// data path. Mounted at /admin/audit-log by AdminPortal.tsx.
const AdminAuditLogPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <BackButton variant="ink" />
      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-1">
          <ScrollText className="w-5 h-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">
            {t('adminPortal.activityLogHeading')}
          </h1>
        </div>
        <p className="text-ink/60 mb-4">{t('adminPortal.activityLogDesc')}</p>
        <RecentActivity />
      </div>
    </div>
  );
};

export default AdminAuditLogPage;
