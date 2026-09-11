import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPinned, FileSearch, ClipboardList, ShieldCheck, BarChart3, ArrowRight } from 'lucide-react';

const FEATURE_CARDS = [
  { icon: MapPinned, titleKey: 'features.searchTitle', bodyKey: 'features.searchBody' },
  { icon: FileSearch, titleKey: 'features.verifyTitle', bodyKey: 'features.verifyBody' },
  { icon: ClipboardList, titleKey: 'features.requestsTitle', bodyKey: 'features.requestsBody' },
  { icon: ShieldCheck, titleKey: 'features.governanceTitle', bodyKey: 'features.governanceBody' },
  { icon: BarChart3, titleKey: 'features.adminTitle', bodyKey: 'features.adminBody' },
];

const FeaturesPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      {/* Header Card */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-6 sm:p-8 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-0.5 rounded-[4px] bg-emerald-50 dark:bg-emerald-950/60 text-[var(--bhashini-accent)] text-xs font-semibold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
            Platform Capabilities
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-heading)] mb-4">
          {t('features.heading')}
        </h1>
        <p className="text-[var(--text-primary)] leading-relaxed text-sm sm:text-base">
          {t('features.intro')}
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2">
        {FEATURE_CARDS.map(({ icon: Icon, titleKey, bodyKey }) => (
          <div
            key={titleKey}
            className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[8px] p-6 shadow-xs hover:border-[var(--bhashini-accent)] transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-[4px] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[var(--bhashini-accent)] mb-4">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-base text-[var(--text-heading)] mb-2">{t(titleKey)}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-normal">{t(bodyKey)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="pt-2">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-[4px] bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] px-5 py-2.5 text-xs sm:text-sm font-medium text-white transition shadow-xs"
        >
          <span>{t('features.cta')}</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
};

export default FeaturesPage;
