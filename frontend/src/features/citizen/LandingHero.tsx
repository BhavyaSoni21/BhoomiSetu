import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { ArrowRight, LogIn, ShieldCheck, Landmark } from 'lucide-react';
import { useAuthUser } from '../auth/auth';

// Public Home hero (docs/FRONTEND_UPGRADE_SPEC.md §2's "Landing page header" -
// value proposition over feature cards). Previously this rendered a
// scroll-to-section hero for the old single-page CitizenPortal (search/map/
// verify all lived below it on the same page); now that guest search is gone
// and those tools moved behind sign-in into the Citizen Portal (§1), the two
// CTAs point at /register and /login instead of scrolling anywhere on this
// page, and the old 4-feature-card grid (which promised anonymous search) is
// gone rather than updated in place - it was the actual thing this rewrite
// needed to remove.
//
// Carries the BhoomiSetu logo/wordmark itself now (per the user's follow-up:
// "remove bhoomisetu from the nav bar and add that to the landing home
// page") - the navbar (App.tsx) no longer shows it at all. A signed-in
// citizen can reach this page too (App.tsx's "/" route no longer redirects
// citizens away, per "citizens should be able to see the home and about
// page"), so the CTA row is auth-aware: Get Started/Sign In only make sense
// for a guest.
export const LandingHero: React.FC = () => {
  const { t } = useTranslation();
  const { data: authUser } = useAuthUser();

  return (
    <div className="relative w-full font-sans">
      {/* Hero Banner - geometric composition (design.md §9) replaces the old
          photographic aerial-land background: land parcels are already
          geometry, so overlapping shapes in the primary/secondary/accent
          slots echo the product's own subject matter instead of a stock photo. */}
      <div className="relative min-h-[560px] lg:min-h-[620px] w-full flex flex-col justify-center bg-bhoomi-dark overflow-hidden border-b-2 sm:border-b-4 border-ink">
        {/* Decorative geometric shapes - purely visual, hidden from a11y tree */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -right-16 top-10 w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-primary/25 border-4 border-primary/40" />
          <div className="absolute right-10 bottom-0 w-48 h-48 sm:w-64 sm:h-64 bg-secondary/30 border-4 border-secondary/50 rotate-12" />
          <div className="absolute right-40 top-1/3 w-0 h-0 border-l-[70px] border-l-transparent border-r-[70px] border-r-transparent border-b-[120px] border-b-accent/25 hidden lg:block" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-ink/40 hidden lg:block" />
        </div>

        {/* Hero Content Container with Generous Breathing Space */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 w-full">
          <div className="max-w-3xl space-y-6 sm:space-y-7">
            {/* BhoomiSetu brand mark - lives only here now, not in the navbar */}
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white p-1 flex items-center justify-center border-2 border-ink shadow-hard-sm shrink-0">
                <img src="/bhoomisetu-logo.png" alt={t('nav.logoAlt')} className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl sm:text-[28px] font-black tracking-tight font-display text-white">
                    <span className="text-primary">Bhoomi</span>
                    <span className="text-secondary">Setu</span>
                  </span>
                  <span className="hidden sm:inline-block px-2.5 py-0.5 bg-secondary/20 text-accent border border-secondary/50 font-bold text-[10px] tracking-wider uppercase">
                    {t('nav.badge')}
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs text-white/60 font-medium mt-0.5">{t('nav.brandTagline')}</span>
              </div>
            </div>

            {/* Government Initiative Badge with Flag Accent */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface/10 border-2 border-primary/50 text-primary text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-bold text-white uppercase tracking-wider">{t('hero.badgeDigitalIndia')}</span>
              <span className="text-white/30">•</span>
              <span className="text-primary uppercase tracking-wider">{t('hero.badgeVerified')}</span>
            </div>

            {/* Clear, Human Headline without AI Jargon */}
            <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black text-white tracking-tight leading-tight font-display uppercase">
              {t('hero.headlineLine1')} <br />
              <span className="text-primary">{t('hero.headlineLine2')}</span>
            </h1>

            {/* Conversational, Empathetic Body Copy */}
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs sm:text-sm font-bold text-accent tracking-wide uppercase flex items-center gap-2">
                <Landmark className="w-4 h-4" aria-hidden="true" />
                <span>{t('nav.brandTagline')}</span>
              </p>
              <p className="text-white/90 text-base sm:text-lg leading-relaxed font-medium">
                {t('hero.bodyP1')}
              </p>
              <p className="text-white/70 text-sm sm:text-base leading-relaxed font-medium">
                {t('hero.bodyP2')}
              </p>
            </div>

            {/* Direct, Action-Oriented CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {authUser ? (
                <Link
                  to="/citizen"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-secondary hover:bg-secondary-strong px-6 py-3.5 text-white font-bold text-sm sm:text-base uppercase tracking-wide shadow-hard-md transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <span>{t('hero.ctaGoToDashboard')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-secondary hover:bg-secondary-strong px-6 py-3.5 text-white font-bold text-sm sm:text-base uppercase tracking-wide shadow-hard-md transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    <span>{t('hero.ctaGetStarted')}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>

                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 border-2 border-white/40 bg-white/5 hover:bg-white/10 px-6 py-3.5 text-white font-bold text-sm sm:text-base uppercase tracking-wide transition"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    <span>{t('hero.ctaSignIn')}</span>
                  </Link>
                </>
              )}
            </div>

            {/* Trust Signal / Quick Helper Text */}
            <div className="flex items-center gap-2 text-xs text-white/60 pt-1 font-medium">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>{t('hero.trustText')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingHero;
