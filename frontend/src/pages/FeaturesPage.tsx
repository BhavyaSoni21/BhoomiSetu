import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPinned, FileSearch, ClipboardList, ShieldCheck, BarChart3, ArrowRight } from 'lucide-react';

// Public, informational page (docs/FRONTEND_UPGRADE_SPEC.md §1.1/§2) -
// explains real, built capabilities without exposing the functional tools
// themselves (those live behind sign-in in the respective portal).
const FEATURE_CARDS = [
  { icon: MapPinned, titleKey: 'features.searchTitle', bodyKey: 'features.searchBody', accent: 'primary' as const },
  { icon: FileSearch, titleKey: 'features.verifyTitle', bodyKey: 'features.verifyBody', accent: 'secondary' as const },
  { icon: ClipboardList, titleKey: 'features.requestsTitle', bodyKey: 'features.requestsBody', accent: 'accent' as const },
  { icon: ShieldCheck, titleKey: 'features.governanceTitle', bodyKey: 'features.governanceBody', accent: 'secondary' as const },
  { icon: BarChart3, titleKey: 'features.adminTitle', bodyKey: 'features.adminBody', accent: 'primary' as const },
];

const ACCENT_CLASSES: Record<'primary' | 'secondary' | 'accent', string> = {
  primary: 'bg-primary/15 border-primary/50 text-primary',
  secondary: 'bg-secondary/15 border-secondary/50 text-secondary',
  accent: 'bg-accent/20 border-accent/60 text-accent',
};

const FeaturesPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6 sm:p-8">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-accent border-2 border-ink" aria-hidden="true" />
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-display text-ink mb-4">
          {t('features.heading')}
        </h1>
        <p className="text-ink/80 leading-relaxed">{t('features.intro')}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {FEATURE_CARDS.map(({ icon: Icon, titleKey, bodyKey, accent }) => (
          <div key={titleKey} className="bg-surface border-2 border-ink shadow-hard-sm p-5 transition hover:-translate-y-1">
            <div className={`w-10 h-10 border-2 flex items-center justify-center mb-3 ${ACCENT_CLASSES[accent]}`}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="font-black uppercase text-sm tracking-wide text-ink mb-1">{t(titleKey)}</h3>
            <p className="text-sm text-ink/70 leading-relaxed">{t(bodyKey)}</p>
          </div>
        ))}
      </div>

      <Link
        to="/login"
        className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-secondary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        {t('features.cta')}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
};

export default FeaturesPage;
