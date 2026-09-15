import React from 'react';
import { BarChart3, ShieldCheck, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../../context/LanguageContext';

interface GovernanceSummaryProps {
  onViewClick?: () => void;
}

const GovernanceSummary: React.FC<GovernanceSummaryProps> = ({ onViewClick }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('governanceSummary.heading')}</h3>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 gap-4">
        <div className="bg-surface/50 border rounded-lg p-4">
          <p className="text-sm text-ink/60 mb-1">{t('governanceSummary.departmentsActive')}</p>
          <p className="text-2xl font-black text-ink">7</p>
        </div>
        <div className="bg-surface/50 border rounded-lg p-4">
          <p className="text-sm text-ink/60 mb-1">{t('governanceSummary.governanceAlerts')}</p>
          <p className="text-2xl font-black text-ink">12</p>
        </div>
        <div className="bg-surface/50 border rounded-lg p-4">
          <p className="text-sm text-ink/60 mb-1">{t('governanceSummary.workflowsPending')}</p>
          <p className="text-2xl font-black text-ink">34</p>
        </div>
      </div>
      <div className="p-6 border-t border-ink/20">
        <button
          type="button"
          onClick={onViewClick}
          className="w-full inline-flex items-center justify-center gap-2 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          {t('governanceSummary.viewGovernance')}
        </button>
      </div>
    </div>
  );
};

export default GovernanceSummary;