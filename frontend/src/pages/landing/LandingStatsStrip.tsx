import React from 'react';
import { LandingContent } from './content';

interface LandingStatsStripProps {
  t: LandingContent;
}

// KNOWN_RISKS.md LOW-3 split - section 3 (TRUST STATS STRIP ON WHITE), unchanged markup.
const LandingStatsStrip: React.FC<LandingStatsStripProps> = ({ t }) => (
  <section className="w-full bg-white dark:bg-[#122b20] border-b border-black/10 dark:border-white/10 shadow-xs">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/10 dark:divide-white/10">
        {t.stats.map((stat, idx) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center justify-center text-center p-4 ${
              idx > 1 ? 'pt-6 md:pt-4' : ''
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-3xl sm:text-4xl lg:text-[44px] text-[#0F3D2E] dark:text-white tracking-tight">
                {stat.value}
              </span>
              {stat.isLive && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#166534] dark:bg-emerald-400 animate-pulse mt-1" />
              )}
            </div>
            <span className="text-xs sm:text-[13px] font-semibold uppercase tracking-wider text-[#718078] dark:text-white/60 mt-1">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default LandingStatsStrip;
