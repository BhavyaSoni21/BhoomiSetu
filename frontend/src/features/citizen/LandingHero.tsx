import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPinned, ShieldCheck, Landmark, FileSearch, ShieldQuestion } from 'lucide-react';

interface LandingHeroProps {
  onSearchClick?: () => void;
  onExploreMap?: () => void;
  onVerifyClick?: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSearchClick,
  onExploreMap,
  onVerifyClick,
}) => {
  const { t } = useTranslation();
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
              <button
                type="button"
                onClick={() => {
                  onSearchClick ? onSearchClick() : scrollTo('parcel-search-section');
                }}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-secondary hover:bg-secondary-strong px-6 py-3.5 text-white font-bold text-sm sm:text-base uppercase tracking-wide shadow-hard-md transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <span>{t('hero.ctaFindPlot')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onExploreMap ? onExploreMap() : scrollTo('map-view-section');
                }}
                className="inline-flex items-center gap-2 border-2 border-white/40 bg-white/5 hover:bg-white/10 px-6 py-3.5 text-white font-bold text-sm sm:text-base uppercase tracking-wide transition"
              >
                <MapPinned className="w-4 h-4" aria-hidden="true" />
                <span>{t('hero.ctaOpenMap')}</span>
              </button>
            </div>

            {/* Trust Signal / Quick Helper Text */}
            <div className="flex items-center gap-2 text-xs text-white/60 pt-1 font-medium">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>{t('hero.trustText')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Section — bordered, divided grid (design.md §8) */}
      <div className="bg-bhoomi-dark px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-2 sm:border-4 border-ink divide-y-2 sm:divide-y-0 sm:divide-x-2 lg:divide-x-4 divide-ink">
            {/* Card 1: Search */}
            <button
              type="button"
              onClick={() => {
                onSearchClick ? onSearchClick() : scrollTo('parcel-search-section');
              }}
              className="text-left bg-transparent hover:bg-white/5 p-5 sm:p-6 text-white transition-colors duration-150 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 border-2 border-secondary/50 bg-secondary/20 flex items-center justify-center text-accent">
                    <FileSearch className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-accent group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </div>
                <h3 className="font-black text-base sm:text-lg text-white uppercase tracking-tight font-display group-hover:text-accent transition-colors">
                  {t('hero.card1Title')}
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2 leading-relaxed">
                  {t('hero.card1Desc')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t-2 border-white/10 text-[11px] text-accent font-bold uppercase tracking-wide flex items-center gap-1">
                <span>{t('hero.card1Link')}</span>
              </div>
            </button>

            {/* Card 2: Map */}
            <button
              type="button"
              onClick={() => {
                onExploreMap ? onExploreMap() : scrollTo('map-view-section');
              }}
              className="text-left bg-transparent hover:bg-white/5 p-5 sm:p-6 text-white transition-colors duration-150 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 border-2 border-primary/50 bg-primary/20 flex items-center justify-center text-primary">
                    <MapPinned className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-primary group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </div>
                <h3 className="font-black text-base sm:text-lg text-white uppercase tracking-tight font-display group-hover:text-primary transition-colors">
                  {t('hero.card2Title')}
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2 leading-relaxed">
                  {t('hero.card2Desc')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t-2 border-white/10 text-[11px] text-primary font-bold uppercase tracking-wide flex items-center gap-1">
                <span>{t('hero.card2Link')}</span>
              </div>
            </button>

            {/* Card 3: Document Verification */}
            <button
              type="button"
              onClick={() => {
                onVerifyClick ? onVerifyClick() : scrollTo('document-verification-section');
              }}
              className="text-left bg-transparent hover:bg-white/5 p-5 sm:p-6 text-white transition-colors duration-150 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 border-2 border-accent/50 bg-accent/20 flex items-center justify-center text-accent">
                    <ShieldQuestion className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-accent group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </div>
                <h3 className="font-black text-base sm:text-lg text-white uppercase tracking-tight font-display group-hover:text-accent transition-colors">
                  {t('hero.card3Title')}
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2 leading-relaxed">
                  {t('hero.card3Desc')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t-2 border-white/10 text-[11px] text-accent font-bold uppercase tracking-wide flex items-center gap-1">
                <span>{t('hero.card3Link')}</span>
              </div>
            </button>

            {/* Card 4: Officer & Admin Portal */}
            <a
              href="/officer"
              className="bg-transparent hover:bg-white/5 p-5 sm:p-6 text-white transition-colors duration-150 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 border-2 border-primary/50 bg-primary/20 flex items-center justify-center text-primary">
                    <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-primary group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </div>
                <h3 className="font-black text-base sm:text-lg text-white uppercase tracking-tight font-display group-hover:text-primary transition-colors">
                  {t('hero.card4Title')}
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2 leading-relaxed">
                  {t('hero.card4Desc')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t-2 border-white/10 text-[11px] text-primary font-bold uppercase tracking-wide flex items-center gap-1">
                <span>{t('hero.card4Link')}</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingHero;
