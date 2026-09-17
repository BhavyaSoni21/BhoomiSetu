import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { ScanSearch } from 'lucide-react';
import ChangeDetectionPanel from '../../features/change-detection/ChangeDetectionPanel';
import BackButton from '../../components/BackButton';

const ChangeDetectionPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <ScanSearch className="w-4 h-4 text-action-600" />
          <span>Satellite / Imagery Change Detection</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.changeDetection', 'Change Detection')}
        </h1>
      </div>

      <ChangeDetectionPanel />
    </div>
  );
};

export default ChangeDetectionPage;
