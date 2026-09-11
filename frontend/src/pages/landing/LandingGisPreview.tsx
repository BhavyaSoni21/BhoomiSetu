import React from 'react';
import { Search, MapPin } from 'lucide-react';
import MapComponent from '../../features/map/MapComponent';
import { ParcelSummary } from '../../types/parcel';
import { LandingContent } from './content';

interface LandingGisPreviewProps {
  t: LandingContent;
  puneParcels: ParcelSummary[];
  setIsSearchModalOpen: (open: boolean) => void;
}

// KNOWN_RISKS.md LOW-3 split - section 5 (LIVE GIS PREVIEW, two-column with
// the real Pune cluster map), unchanged markup.
const LandingGisPreview: React.FC<LandingGisPreviewProps> = ({ t, puneParcels, setIsSearchModalOpen }) => (
  <section className="w-full bg-[#F1F5EF] dark:bg-[#0e241b] py-20 sm:py-24 border-y border-black/10 dark:border-white/10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Eyebrow, Heading, Body Copy, Color Legend */}
        <div className="lg:col-span-5 space-y-6">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
            {t.gisPreview.eyebrow}
          </div>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-[#0F3D2E] dark:text-white tracking-tight leading-tight">
            {t.gisPreview.heading}
          </h2>
          <p className="text-[#53635A] dark:text-white/75 text-base sm:text-[17px] leading-relaxed">
            {t.gisPreview.body}
          </p>

          {/* Quick Action to open search */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] text-white font-heading font-semibold text-xs uppercase tracking-wider transition shadow-sm"
            >
              <Search className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Inspect Cadastral Plot</span>
            </button>
          </div>
        </div>

        {/* Right Column: Stylized SVG Parcel Grid Card */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-[#143225] rounded-2xl border border-black/10 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Header row of the card */}
            <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#166534] animate-pulse" />
                <span className="font-heading font-bold text-sm text-[#0F3D2E] dark:text-white">
                  Pune Cluster
                </span>
              </div>
              <span className="font-mono text-xs text-[#718078] dark:text-white/60 font-semibold">
                18.52°N · 73.85°E
              </span>
            </div>

            {/* The real Pune cluster, not a mockup - MapComponent fetches
                live parcel geometry via /gis/parcels + real spatial
                context, so this is the same map the Citizen/Officer
                Portals use, just handed only Pune's own parcels and
                locked to them (no search box, no layer switching to a
                different cluster) for this preview. */}
            <div className="bg-[#F7FAF5]/50 dark:bg-black/20">
              <MapComponent parcels={puneParcels} fitToParcels showLayerPanel={false} />
            </div>

            {/* Footer of the card */}
            <div className="px-6 py-3.5 bg-gray-50/70 dark:bg-black/20 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-mono text-[#53635A] dark:text-white/70">
                <MapPin className="w-3.5 h-3.5 text-[#D97706]" />
                <span>{puneParcels.length} parcels · PostGIS-backed</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-[#166534]/15 text-[#166534] dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold text-[11px] border border-[#166534]/20">
                Live Data
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LandingGisPreview;
