import React from 'react';
import { LandingContent } from './content';

interface LandingHowItWorksProps {
  t: LandingContent;
}

// KNOWN_RISKS.md LOW-3 split - section 4 (HOW IT WORKS, light theme, 96px
// vertical padding), unchanged markup.
const LandingHowItWorks: React.FC<LandingHowItWorksProps> = ({ t }) => (
  <section id="features" className="w-full py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="space-y-4 max-w-2xl mb-12 sm:mb-16">
      {/* Eyebrow: mono, tracked, amber */}
      <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
        {t.howItWorks.eyebrow}
      </div>
      {/* Montserrat bold heading */}
      <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-[#0F3D2E] dark:text-white tracking-tight leading-tight">
        {t.howItWorks.heading}
      </h2>
    </div>

    {/* 4-step grid of white cards with thin borders */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {t.howItWorks.steps.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.num}
            className="bg-white dark:bg-[#143225] rounded-2xl p-6 sm:p-7 border border-black/10 dark:border-white/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F7FAF5] dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center text-[#0F3D2E] dark:text-white group-hover:bg-[#0F3D2E] group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-semibold text-[#718078] dark:text-white/60">
                  {step.num}
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-[#0F3D2E] dark:text-white mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-[#53635A] dark:text-white/70 leading-relaxed font-normal">
                {step.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export default LandingHowItWorks;
