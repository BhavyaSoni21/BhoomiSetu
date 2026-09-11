import React from 'react';
import { LandingContent } from './content';

interface LandingLandAgricultureProps {
  t: LandingContent;
}

// KNOWN_RISKS.md LOW-3 split - section 7 (LAND & AGRICULTURE, earth-tone
// accents), unchanged markup.
const LandingLandAgriculture: React.FC<LandingLandAgricultureProps> = ({ t }) => (
  <section id="about" className="w-full bg-[#F7FAF5] dark:bg-[#0a1a13] py-20 sm:py-24 border-t border-black/10 dark:border-white/10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left: Stylized Land Parcel Visual Card */}
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden p-8 sm:p-10 text-white shadow-xl min-h-[340px] flex flex-col justify-between">
            {/* Aerial parcel photo background */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/parcel-snapshot.png')" }}
              role="img"
              aria-label="Aerial photograph of a highlighted agricultural land parcel"
            />

            {/* Scrim for text legibility */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(15,26,17,0.55) 0%, rgba(15,26,17,0.05) 35%, rgba(15,26,17,0.05) 55%, rgba(15,26,17,0.75) 100%)',
              }}
              aria-hidden="true"
            />

            <div className="relative z-10 space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/80 font-bold">
                {t.landAgri.snapshotBadge}
              </span>
            </div>

            <div className="relative z-10">
              <h3 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
                {t.landAgri.snapshotTitle}
              </h3>
            </div>
          </div>
        </div>

        {/* Right: Eyebrow, Heading, Body & Metadata Grid */}
        <div className="lg:col-span-7 space-y-6">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
            {t.landAgri.eyebrow}
          </div>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-[#0F3D2E] dark:text-white tracking-tight leading-tight">
            {t.landAgri.heading}
          </h2>
          <p className="text-[#53635A] dark:text-white/75 text-base leading-relaxed">
            {t.landAgri.body}
          </p>

          {/* Grid of metadata cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {t.landAgri.metadata.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="p-4 rounded-xl bg-white dark:bg-[#143225] border border-black/10 dark:border-white/10 shadow-xs flex items-center gap-3.5"
                >
                  <div className="p-2.5 rounded-lg bg-[#F7FAF5] dark:bg-white/10 text-[#92400E] dark:text-[#F59E0B] shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-white/60">
                      {item.label}
                    </span>
                    <span className="font-mono font-bold text-sm text-[#0F3D2E] dark:text-white">
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LandingLandAgriculture;
