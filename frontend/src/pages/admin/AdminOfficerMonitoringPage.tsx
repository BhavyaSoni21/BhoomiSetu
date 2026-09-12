import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import OfficerMonitoring from '../../features/admin/OfficerMonitoring';
import BackButton from '../../components/BackButton';

// "Officer monitoring - how officers handle citizen issues"
// (docs/ADMIN_PANEL_ISSUES.md Admin #4) - built from data that already
// exists (WorkflowStep for pending workload, AuditLog for who personally
// approved/rejected what), no new logging. See OfficerMonitoring.tsx /
// AnalyticsService.getOfficerMonitoring for how each column is computed.
const AdminOfficerMonitoringPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <BackButton variant="ink" />
      <div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">{t('adminNav.officerMonitoring')}</h1>
        <p className="text-ink/60 mt-1">{t('adminPortal.officerMonitoringSubtitle')}</p>
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" aria-hidden="true" />
          {t('adminPortal.officerWorkloadHeading')}
        </h2>
        <OfficerMonitoring />
      </div>
    </div>
  );
};

export default AdminOfficerMonitoringPage;
