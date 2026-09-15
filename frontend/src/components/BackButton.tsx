import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface BackButtonProps {
  className?: string;
  // Matches whichever of this app's two page-header styles the page it's
  // dropped into already uses - the "gov-*" admin/officer/citizen portal
  // pages (brand/action colors, font-mono eyebrows) vs. the Bauhaus "ink"
  // style (Parcel 360, Notifications, Admin sub-pages).
  variant?: 'gov' | 'ink';
  label?: string;
}

const VARIANT_CLASS: Record<'gov' | 'ink', string> = {
  gov: 'text-text-secondary hover:text-text-heading font-mono font-semibold',
  ink: 'text-ink/50 hover:text-ink font-bold',
};

// Browser-history back (matches Parcel360View's own pre-existing back
// button), not a fixed per-page destination - the natural "return to
// whatever list/filter/tab I was just on" a user expects, including state
// a fixed route target can't reconstruct (search results, scroll position).
const BackButton: React.FC<BackButtonProps> = ({ className = '', variant = 'gov', label }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-wider transition ${VARIANT_CLASS[variant]} ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
      {label ?? t('common.back')}
    </button>
  );
};

export default BackButton;
