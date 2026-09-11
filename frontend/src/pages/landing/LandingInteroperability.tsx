import React from 'react';
import { LandingContent } from './content';

interface LandingInteroperabilityProps {
  t: LandingContent;
}

// KNOWN_RISKS.md LOW-3 split - section 6 (INTEROPERABILITY BAND), unchanged markup.
const LandingInteroperability: React.FC<LandingInteroperabilityProps> = ({ t }) => (
  <section className="w-full py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
    <div className="max-w-2xl mx-auto space-y-3 mb-10 sm:mb-12">
      {/* Centered eyebrow: mono, amber, tracked */}
      <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
        {t.interoperability.eyebrow}
      </div>
      <h2 className="font-heading font-bold text-3xl sm:text-4xl text-[#0F3D2E] dark:text-white tracking-tight">
        {t.interoperability.heading}
      </h2>
    </div>

    {/* 7 pill badges in a wrap row */}
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
      {t.interoperability.feeds.map((feed) => {
        const Icon = feed.icon;
        return (
          <div
            key={feed.name}
            className="w-36 sm:w-40 h-12 flex items-center justify-center gap-2.5 px-3 rounded-xl bg-white dark:bg-[#143225] border border-black/10 dark:border-white/10 text-[#0F3D2E] dark:text-white shadow-xs hover:border-[#166534] hover:shadow-sm transition-all duration-150 cursor-default"
          >
            <Icon className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
            <span className="font-heading font-semibold text-xs sm:text-sm tracking-tight whitespace-nowrap">
              {feed.name}
            </span>
          </div>
        );
      })}
    </div>
  </section>
);

export default LandingInteroperability;
