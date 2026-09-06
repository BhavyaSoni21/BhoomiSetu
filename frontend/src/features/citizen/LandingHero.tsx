import React from 'react';

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
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full font-sans">
      {/* Full-width Hero Banner with Aerial Land Background & Organic Forest Green / Soil Clay Gradient */}
      <div className="relative min-h-[560px] lg:min-h-[620px] w-full flex flex-col justify-center bg-[#08150f]">
        {/* Background Image: Aerial land parcels */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: "url('/hero-land-bg.png')",
          }}
        />

        {/* Natural Vignette Overlay: Deep forest green on left blending to warm soil tones on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#08150f]/98 via-[#0e241b]/90 to-[#1f140a]/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08150f] via-transparent to-black/40" />

        {/* Hero Content Container with Generous Breathing Space */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 w-full">
          <div className="max-w-3xl space-y-6 sm:space-y-7">
            {/* Government Initiative Badge with Flag Accent */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#142f24]/80 border border-[#52b788]/40 text-[#52b788] text-xs font-medium tracking-wide backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#52b788] animate-pulse"></span>
              <span className="font-semibold text-white">डिजिटल इंडिया भू-अभिलेख</span>
              <span className="text-emerald-500/60">•</span>
              <span className="text-emerald-200">14-Digit Bhu-Aadhaar (ULPIN) Verified</span>
            </div>

            {/* Clear, Human Headline without AI Jargon */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black text-white tracking-tight leading-[1.15] font-display">
                Every detail about your land. <br />
                <span className="text-[#52b788]">In one clear, honest view.</span>
              </h1>
            </div>

            {/* Conversational, Empathetic Body Copy */}
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs sm:text-sm font-semibold text-[#e59866] tracking-wide flex items-center gap-2">
                <span>🌱</span>
                <span>ज़मीन एक, जानकारी अनेक, जोड़ता है BhoomiSetu</span>
              </p>
              <p className="text-emerald-100/90 text-base sm:text-lg leading-relaxed font-normal">
                Checking your 7/12 extract, finding exact plot borders, or verifying ownership papers
                shouldn't take three trips to the Taluka office.
              </p>
              <p className="text-emerald-200/75 text-sm sm:text-base leading-relaxed font-normal">
                BhoomiSetu links your registry papers, cadastral map lines, and revenue records in one simple dashboard.
                Search any plot across Pune and Maharashtra in seconds — free, open, and transparent.
              </p>
            </div>

            {/* Direct, Action-Oriented CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  onSearchClick ? onSearchClick() : scrollTo('parcel-search-section');
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#7c3f1d] via-[#935116] to-[#b36b28] hover:from-[#6b3518] hover:to-[#8c4915] text-white font-bold text-sm sm:text-base transition duration-150 shadow-xl shadow-amber-950/40 border border-[#c68b59]/40 flex items-center gap-2 group cursor-pointer"
              >
                <span>Find Your Plot Details</span>
                <span className="text-[#e59866] group-hover:translate-x-1 transition-transform">→</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExploreMap ? onExploreMap() : scrollTo('map-view-section');
                }}
                className="px-6 py-3.5 rounded-xl bg-[#142f24]/90 hover:bg-[#1a3d2e] text-white border border-[#2d6a4f] font-semibold text-sm sm:text-base transition duration-150 backdrop-blur-md flex items-center gap-2 group cursor-pointer"
              >
                <span>Open Satellite Map</span>
                <span className="text-[#52b788] group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>

            {/* Trust Signal / Quick Helper Text */}
            <div className="flex items-center gap-2 text-xs text-emerald-200/60 pt-1">
              <svg className="w-4 h-4 text-[#52b788]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>No login needed for parcel search, map boundaries, or registry verification.</span>
            </div>
          </div>
        </div>

      </div>

      {/* Feature Cards Section — Outside hero, full visibility below fold */}
      <div className="bg-[#0a1a13] border-t border-[#1b3d2e] px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Search */}
            <div
              onClick={() => {
                onSearchClick ? onSearchClick() : scrollTo('parcel-search-section');
              }}
              className="bg-[#0e241b]/95 hover:bg-[#142f24] border border-[#234e3b] hover:border-[#7c3f1d] rounded-2xl p-5 sm:p-6 text-white transition-all duration-200 shadow-xl cursor-pointer group backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-[#7c3f1d]/30 border border-[#7c3f1d]/50 flex items-center justify-center text-[#e59866] font-bold text-xl">
                    📍
                  </div>
                  <span className="text-xs text-[#e59866] font-mono group-hover:translate-x-1 transition-transform">→</span>
                </div>
                <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-[#e59866] transition-colors">
                  Search Any Plot
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/75 mt-2 leading-relaxed">
                  Enter your 14-digit Bhu-Aadhaar (ULPIN), Survey, or Gut number. Get owner names, land area, and soil records instantly.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1b3d2e] text-[11px] text-[#e59866] font-semibold flex items-center gap-1">
                <span>Try searching a Pune plot</span>
                <span>›</span>
              </div>
            </div>

            {/* Card 2: Map */}
            <div
              onClick={() => {
                onExploreMap ? onExploreMap() : scrollTo('map-view-section');
              }}
              className="bg-[#0e241b]/95 hover:bg-[#142f24] border border-[#234e3b] hover:border-[#2d6a4f] rounded-2xl p-5 sm:p-6 text-white transition-all duration-200 shadow-xl cursor-pointer group backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-[#2d6a4f]/30 border border-[#2d6a4f]/50 flex items-center justify-center text-[#52b788] font-bold text-xl">
                    🗺️
                  </div>
                  <span className="text-xs text-[#52b788] font-mono group-hover:translate-x-1 transition-transform">→</span>
                </div>
                <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-[#52b788] transition-colors">
                  Check Exact Boundaries
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/75 mt-2 leading-relaxed">
                  See real survey borders drawn over satellite pictures. Spot approach roads, neighbor borders, and water bodies clearly.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1b3d2e] text-[11px] text-[#52b788] font-semibold flex items-center gap-1">
                <span>View cadastre polygon map</span>
                <span>›</span>
              </div>
            </div>

            {/* Card 3: Document Verification */}
            <div
              onClick={() => {
                onVerifyClick ? onVerifyClick() : scrollTo('document-verification-section');
              }}
              className="bg-[#0e241b]/95 hover:bg-[#142f24] border border-[#234e3b] hover:border-[#935116] rounded-2xl p-5 sm:p-6 text-white transition-all duration-200 shadow-xl cursor-pointer group backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-[#935116]/30 border border-[#935116]/50 flex items-center justify-center text-[#c68b59] font-bold text-xl">
                    📄
                  </div>
                  <span className="text-xs text-[#c68b59] font-mono group-hover:translate-x-1 transition-transform">→</span>
                </div>
                <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-[#c68b59] transition-colors">
                  Verify Registry Papers
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/75 mt-2 leading-relaxed">
                  Upload a photo of your 7/12 extract or Sale Deed. We compare names, stamps, and survey numbers directly against official books.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1b3d2e] text-[11px] text-[#c68b59] font-semibold flex items-center gap-1">
                <span>Scan deed or extract</span>
                <span>›</span>
              </div>
            </div>

            {/* Card 4: Officer & Admin Portal */}
            <a
              href="/officer"
              className="bg-[#0e241b]/95 hover:bg-[#142f24] border border-[#234e3b] hover:border-[#52b788] rounded-2xl p-5 sm:p-6 text-white transition-all duration-200 shadow-xl cursor-pointer group backdrop-blur-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-[#1b4332]/50 border border-[#52b788]/40 flex items-center justify-center text-[#52b788] font-bold text-xl">
                    🛡️
                  </div>
                  <span className="text-xs text-[#52b788] font-mono group-hover:translate-x-1 transition-transform">→</span>
                </div>
                <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-[#52b788] transition-colors">
                  Revenue Officer Desk
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/75 mt-2 leading-relaxed">
                  Review land mutation files, inspect satellite change detection for encroachment, and clear pending citizen requests.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1b3d2e] text-[11px] text-[#52b788] font-semibold flex items-center gap-1">
                <span>Department sign-in</span>
                <span>›</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingHero;
