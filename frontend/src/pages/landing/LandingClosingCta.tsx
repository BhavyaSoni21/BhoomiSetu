import React from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { LandingContent } from './content';

interface LandingClosingCtaProps {
  t: LandingContent;
  setIsSearchModalOpen: (open: boolean) => void;
}

// KNOWN_RISKS.md LOW-3 split - section 8 (CLOSING CTA, rounded-3xl amber
// panel with radial glow), unchanged markup.
const LandingClosingCta: React.FC<LandingClosingCtaProps> = ({ t, setIsSearchModalOpen }) => (
  <section className="w-full py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="relative rounded-3xl bg-[#D97706] text-[#16241A] p-8 sm:p-14 lg:p-16 overflow-hidden shadow-xl">
      {/* Radial white glow at top-right at 30% opacity */}
      <div
        className="absolute -top-24 -right-24 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 70%)',
        }}
      />

      <div className="relative z-10 max-w-2xl space-y-4">
        <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-[#16241A] tracking-tight leading-tight">
          {t.closingCta.heading}
        </h2>
        <p className="text-[#2b1803] text-base sm:text-lg leading-relaxed font-medium">
          {t.closingCta.body}
        </p>

        <div className="flex flex-wrap items-center gap-3.5 pt-4">
          {/* Dark green button */}
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] text-white font-heading font-bold text-sm sm:text-base tracking-wide transition shadow-md"
          >
            <Search className="w-4 h-4 text-[#F59E0B]" />
            <span>{t.closingCta.searchButton}</span>
          </button>

          {/* Glass dark button */}
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-black/10 hover:bg-black/15 border border-black/20 text-[#16241A] font-heading font-semibold text-sm sm:text-base tracking-wide transition"
          >
            <span>{t.closingCta.signInButton}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  </section>
);

export default LandingClosingCta;
