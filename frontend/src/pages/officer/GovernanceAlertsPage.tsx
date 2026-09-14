import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import GovernanceAlertsPanel from '../../features/officer/GovernanceAlertsPanel';
import BackButton from '../../components/BackButton';

const GovernanceAlertsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.governanceAlerts', 'Cross-Department Governance Alerts')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Alerts raised from restriction-zone overlaps and year-over-year changes in a parcel's recorded status - review and act on each below.
        </p>
      </div>

      <div className="gov-card p-6">
        <GovernanceAlertsPanel />
      </div>
    </div>
  );
};

export default GovernanceAlertsPage;
