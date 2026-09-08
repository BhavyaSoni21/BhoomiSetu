import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Circle, Square, Triangle } from 'lucide-react';
import LandingHero from '../features/citizen/LandingHero';

// Public, guest-only Home (docs/FRONTEND_UPGRADE_SPEC.md §1/§2) - purely
// informational, no personal parcel data, no search box. App.tsx redirects
// a signed-in user to their own portal before this ever mounts, so this
// component itself doesn't need to be auth-aware. Same role-shape convention
// as AboutPage/the navbar: circle=Citizen, square=Officer, triangle=Admin.
const HomePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <LandingHero />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-4">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">
            {t('home.howItWorksHeading')}
          </h2>
          <p className="text-ink/60">{t('home.howItWorksDesc')}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3 pt-6">
          <div className="bg-surface border-2 border-ink shadow-hard-sm p-5 transition hover:-translate-y-1">
            <div className="w-10 h-10 rounded-full bg-primary/15 border-2 border-primary/50 flex items-center justify-center text-primary mb-3">
              <Circle className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-black uppercase text-sm tracking-wide text-ink mb-1">{t('home.step1Title')}</h3>
            <p className="text-sm text-ink/70 leading-relaxed">{t('home.step1Desc')}</p>
          </div>
          <div className="bg-surface border-2 border-ink shadow-hard-sm p-5 transition hover:-translate-y-1">
            <div className="w-10 h-10 bg-secondary/15 border-2 border-secondary/50 flex items-center justify-center text-secondary mb-3">
              <Square className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-black uppercase text-sm tracking-wide text-ink mb-1">{t('home.step2Title')}</h3>
            <p className="text-sm text-ink/70 leading-relaxed">{t('home.step2Desc')}</p>
          </div>
          <div className="bg-surface border-2 border-ink shadow-hard-sm p-5 transition hover:-translate-y-1">
            <div className="w-10 h-10 bg-accent/20 border-2 border-accent/60 flex items-center justify-center text-accent mb-3">
              <Triangle className="w-4 h-4 fill-current" aria-hidden="true" />
            </div>
            <h3 className="font-black uppercase text-sm tracking-wide text-ink mb-1">{t('home.step3Title')}</h3>
            <p className="text-sm text-ink/70 leading-relaxed">{t('home.step3Desc')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
          <Link
            to="/about"
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {t('home.learnMoreCta')}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
          <Link
            to="/features"
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {t('home.featuresCta')}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
