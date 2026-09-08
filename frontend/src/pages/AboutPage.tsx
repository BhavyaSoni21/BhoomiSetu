import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Circle, Square, Triangle, ArrowRight } from 'lucide-react';

// Public, informational page (docs/FRONTEND_UPGRADE_SPEC.md §1.1/§2) - no
// personal parcel data, no functional tools, just what the platform is and
// who it's for. Same role-shape convention as the nav/portal switcher:
// circle=Citizen, square=Officer, triangle=Admin.
const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6 sm:p-8">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink" aria-hidden="true" />
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight font-display text-ink mb-4">
          {t('about.heading')}
        </h1>
        <p className="text-ink/80 leading-relaxed">{t('about.intro')}</p>
      </div>

      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6 sm:p-8">
        <span className="absolute -top-3 -right-3 w-6 h-6 bg-secondary border-2 border-ink" aria-hidden="true" />
        <h2 className="text-xl font-black uppercase tracking-wide font-display text-ink mb-3">{t('about.missionHeading')}</h2>
        <p className="text-ink/80 leading-relaxed">{t('about.missionBody')}</p>
      </div>

      <div>
        <h2 className="text-xl font-black uppercase tracking-wide font-display text-ink mb-4">{t('about.audienceHeading')}</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="bg-surface border-2 border-ink shadow-hard-sm p-5 transition hover:-translate-y-1">
            <div className="w-10 h-10 rounded-full bg-primary/15 border-2 border-primary/50 flex items-center justify-center text-primary mb-3">
              <Circle className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-black uppercase text-sm tracking-wide text-ink mb-1">{t('about.citizenTitle')}</h3>
            <p className="text-sm text-ink/70 leading-relaxed">{t('about.citizenBody')}</p>
          </div>
          <div className="bg-surface border-2 border-ink shadow-hard-sm p-5 transition hover:-translate-y-1">
            <div className="w-10 h-10 bg-secondary/15 border-2 border-secondary/50 flex items-center justify-center text-secondary mb-3">
              <Square className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-black uppercase text-sm tracking-wide text-ink mb-1">{t('about.officerTitle')}</h3>
            <p className="text-sm text-ink/70 leading-relaxed">{t('about.officerBody')}</p>
          </div>
          <div className="bg-surface border-2 border-ink shadow-hard-sm p-5 transition hover:-translate-y-1">
            <div className="w-10 h-10 bg-accent/20 border-2 border-accent/60 flex items-center justify-center text-accent mb-3">
              <Triangle className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-black uppercase text-sm tracking-wide text-ink mb-1">{t('about.adminTitle')}</h3>
            <p className="text-sm text-ink/70 leading-relaxed">{t('about.adminBody')}</p>
          </div>
        </div>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        {t('about.cta')}
        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
};

export default AboutPage;
