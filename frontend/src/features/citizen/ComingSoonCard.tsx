import React from 'react';
import { useTranslation } from '../../context/LanguageContext';

interface ComingSoonCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accentClass: string;
}

// Rule 8 (docs/flow.md): a feature that isn't built yet gets a visibly
// "coming soon" placeholder in the layout - never a working-looking control
// with nothing behind it. Reduced opacity + a badge + no click handler on
// anything inside signal "not open yet" rather than "broken". Shared across
// the Citizen Portal's Dashboard/Documents/Notifications pages
// (docs/FRONTEND_UPGRADE_SPEC.md §4) - previously a local component inside
// the single-page CitizenPortal.tsx this replaces.
const ComingSoonCard: React.FC<ComingSoonCardProps> = ({ icon: Icon, title, description, accentClass }) => {
  const { t } = useTranslation();
  return (
    <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6 opacity-70">
      <span className={`absolute -top-3 -right-3 w-6 h-6 rounded-full ${accentClass} border-2 border-ink`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 border-2 border-ink bg-muted flex items-center justify-center text-ink/50 shrink-0">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink/70 leading-tight">{title}</h2>
        </div>
        <span className="shrink-0 px-2 py-0.5 bg-accent text-ink border-2 border-ink text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
          {t('placeholders.comingSoonBadge')}
        </span>
      </div>
      <p className="text-sm text-ink/50 leading-relaxed">{description}</p>
    </div>
  );
};

export default ComingSoonCard;
