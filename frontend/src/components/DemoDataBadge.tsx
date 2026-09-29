import React from 'react';
import { FlaskConical } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

// Provenance chip: every record in this system is synthetic seed data (there is
// no real land-records ingestion pipeline), so this is always shown rather than
// gated on a flag — an honest, static label, not a runtime state.
const DemoDataBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  return (
    <span
      title={t('demoData.tooltip', 'All records shown are synthetic demonstration data, not real land holdings.')}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-300 ${className}`}
    >
      <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
      {t('demoData.label', 'Demo Data')}
    </span>
  );
};

export default DemoDataBadge;
