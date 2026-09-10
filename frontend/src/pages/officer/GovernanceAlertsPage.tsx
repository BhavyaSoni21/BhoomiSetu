import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, AlertTriangle, ShieldCheck } from 'lucide-react';
import GovernanceAlertsPanel from '../../features/officer/GovernanceAlertsPanel';

const GovernanceAlertsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <div className="pb-4 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-action-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4 text-gov-error" />
            <span>Automated Spatial & Revenue Integrity Sentinel</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            {t('officerNav.governanceAlerts', 'Cross-Department Governance Alerts')}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Real-time anomaly detection identifying encroachment, title duplication, eco-sensitive zone violations, and court stay overlaps.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-red-100 text-red-800 border border-red-200 self-start sm:self-auto">
          Automated Watchdog Active
        </span>
      </div>

      <div className="gov-card p-6">
        <GovernanceAlertsPanel />
      </div>
    </div>
  );
};

export default GovernanceAlertsPage;
