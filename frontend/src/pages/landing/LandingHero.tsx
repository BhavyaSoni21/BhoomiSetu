import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { LandingContent } from './content';

interface LandingHeroProps {
  t: LandingContent;
  setIsSearchModalOpen: (open: boolean) => void;
}

// KNOWN_RISKS.md LOW-3 split - section 2 (HERO SECTION, ~92vh), unchanged markup.
const LandingHero: React.FC<LandingHeroProps> = ({ t, setIsSearchModalOpen }) => (
  <section className="relative w-full h-[92vh] min-h-[640px] max-h-[960px] flex flex-col justify-between overflow-hidden">
    {/* Full-bleed aerial photo background */}
    <div
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/Background.jpeg')" }}
      role="img"
      aria-label="Aerial drone photograph of Indian farmland with crop fields, trees, and village cluster"
    />

    {/* Scrim: ONLY left-to-right linear gradient (rgba(6,21,15,0.95) to transparent at ~62%) + subtle vignettes */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(6, 21, 15, 0.96) 0%, rgba(6, 21, 15, 0.88) 32%, rgba(6, 21, 15, 0.5) 48%, rgba(6, 21, 15, 0) 62%)',
      }}
    />
    {/* Very subtle top and bottom vignettes */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'linear-gradient(180deg, rgba(6, 21, 15, 0.4) 0%, transparent 18%, transparent 82%, rgba(6, 21, 15, 0.6) 100%)',
      }}
    />

    {/* Hero Content - Vertically centered, left-aligned */}
    <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 my-auto pt-24 sm:pt-28">
      <div className="max-w-2xl space-y-6 sm:space-y-7">
        {/* Eyebrow */}
        <div className="inline-block">
          <span className="text-white text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] opacity-90">
            {t.hero.eyebrow}
          </span>
        </div>

        {/* Bold uppercase Montserrat headline */}
        <h1 className="font-heading font-extrabold uppercase text-white tracking-tight leading-[1.08] text-4xl sm:text-6xl lg:text-[72px]">
          {t.hero.headlineLine1}
          <br />
          {t.hero.headlineLine2}
        </h1>

        {/* Body copy: 17-18px Inter, white/85, max-w ~28rem */}
        <p className="text-white/85 text-base sm:text-[18px] leading-relaxed max-w-[28rem] font-normal">
          {t.hero.body}
        </p>

        {/* Two Pill CTAs below */}
        <div className="flex flex-wrap items-center gap-3.5 pt-2">
          {/* (1) Search a Parcel CTA - metallic light-gray vertical gradient */}
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="btn-brushed-metal inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-heading font-bold text-sm sm:text-base cursor-pointer tracking-wide"
          >
            <Search className="w-4 h-4 text-[#16241A]" />
            <span>{t.hero.searchCta}</span>
          </button>

          {/* (2) Get Started CTA - transparent glass */}
          <Link
            to="/register"
            className="btn-hero-glass inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-heading font-medium text-sm sm:text-base cursor-pointer tracking-wide"
          >
            <span>{t.hero.signInCta}</span>
          </Link>
        </div>
      </div>
    </div>

    {/* Hero Bottom Area */}
    <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 space-y-4">
      {/* Bottom hairline + row of tracked government labels */}
      <div className="pt-3 border-t border-white/25">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          <span>GOVERNMENT OF INDIA</span>
          <span className="text-white/30">|</span>
          <span>DIGITAL INDIA</span>
          <span className="text-white/30">|</span>
          <span>SVAMITVA SCHEME</span>
        </div>
      </div>
    </div>
  </section>
);

export default LandingHero;
