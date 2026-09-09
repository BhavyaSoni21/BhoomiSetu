import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import GovernanceAlertsPanel from '../../features/officer/GovernanceAlertsPanel';

const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

const GovernanceAlertsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
      <h2 className={sectionHeadingClass}>
        <ShieldAlert className="w-5 h-5 text-secondary" aria-hidden="true" />
        {t('officerNav.governanceAlerts')}
      </h2>
      <GovernanceAlertsPanel />
    </div>
  );
};

export default GovernanceAlertsPage;
