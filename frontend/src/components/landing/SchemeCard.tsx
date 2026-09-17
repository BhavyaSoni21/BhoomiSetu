import React from 'react';
import {
  IndianRupee,
  Fingerprint,
  CreditCard,
  Leaf,
  ShieldCheck,
  Sun,
  ExternalLink,
  ArrowUpRight,
  LucideIcon,
} from 'lucide-react';
import { GovtScheme } from '../../types/scheme';
import { useTranslation } from '../../context/LanguageContext';

const ICON_MAP: Record<string, LucideIcon> = {
  IndianRupee,
  Fingerprint,
  CreditCard,
  Leaf,
  ShieldCheck,
  Sun,
};

interface SchemeCardProps {
  scheme: GovtScheme;
  isDuplicate?: boolean;
}

export const SchemeCard: React.FC<SchemeCardProps> = ({ scheme, isDuplicate = false }) => {
  const { t, loading } = useTranslation();
  const IconComponent = ICON_MAP[scheme.icon] || ShieldCheck;

  const schemeName = t(scheme.nameKey);
  const audience = t(scheme.audienceKey);
  const benefit = t(scheme.benefitKey);
  const learnMoreText = t('schemes.common.learnMore', 'Learn More');
  const forLabel = t('schemes.common.forLabel', 'Who it\'s for');
  const benefitLabel = t('schemes.common.benefitLabel', 'Benefit');

  return (
    <div
      tabIndex={0}
      role="article"
      aria-label={`${scheme.acronym}: ${schemeName}`}
      aria-hidden={isDuplicate ? 'true' : undefined}
      className="group relative flex flex-col justify-between w-[320px] sm:w-[350px] min-h-[220px] p-5 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--action-500)] shadow-xs hover:shadow-md transition-all duration-300 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-500)] focus-visible:ring-offset-2 shrink-0 text-left"
    >
      {/* Top Row: Icon Chip + Acronym Badge */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs transition-transform duration-200 group-hover:scale-105 ${scheme.accentColor.bg} ${scheme.accentColor.border}`}
          >
            <IconComponent className={`w-5 h-5 ${scheme.accentColor.text}`} />
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase font-mono border ${scheme.accentColor.badgeBg} ${scheme.accentColor.badgeText} ${scheme.accentColor.border}`}
          >
            {scheme.acronym}
          </span>
        </div>

        {/* Scheme Name */}
        <h3 className="text-sm sm:text-[15px] font-bold text-[var(--text-heading)] leading-snug line-clamp-1 mb-2.5">
          {loading ? (
            <span className="inline-block w-4/5 h-4 bg-slate-200 dark:bg-slate-700/60 rounded animate-pulse" />
          ) : (
            schemeName
          )}
        </h3>

        {/* 2-Line Scannable Details */}
        <div className="space-y-1.5 text-xs">
          {/* Line 1: Who it's for */}
          <div className="flex items-start gap-1.5 leading-relaxed text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)] shrink-0 text-[11px]">
              {forLabel}:
            </span>
            {loading ? (
              <span className="inline-block w-3/4 h-3 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
            ) : (
              <span className="line-clamp-1">{audience}</span>
            )}
          </div>

          {/* Line 2: What you get */}
          <div className="flex items-start gap-1.5 leading-relaxed text-[var(--text-primary)] font-medium">
            <span className="font-semibold text-[var(--action-700)] dark:text-[var(--action-500)] shrink-0 text-[11px]">
              {benefitLabel}:
            </span>
            {loading ? (
              <span className="inline-block w-5/6 h-3 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
            ) : (
              <span className="line-clamp-2 text-[var(--brand-700)] dark:text-[var(--brand-300)] font-semibold">
                {benefit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Official Badge & Learn More External Link */}
      <div className="mt-4 pt-3 border-t border-[var(--border)]/70 flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--bhashini-accent)] inline-block" />
          {t('schemes.common.officialPortal', 'Official Govt Scheme')}
        </span>

        <a
          href={scheme.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={isDuplicate ? -1 : 0}
          aria-label={`${learnMoreText} about ${scheme.acronym} on official government portal`}
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--action-700)] dark:text-[var(--action-500)] hover:text-[var(--brand-700)] dark:hover:text-[var(--brand-300)] transition-colors duration-150 group/link"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{loading ? <span className="inline-block w-16 h-3 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" /> : learnMoreText}</span>
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
        </a>
      </div>
    </div>
  );
};

export default SchemeCard;
