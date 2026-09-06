import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface LandGovernanceHeroProps {
  onExploreMap?: () => void;
  onSearchClick?: () => void;
  onVerifyClick?: () => void;
}

export const LandGovernanceHero: React.FC<LandGovernanceHeroProps> = ({
  onExploreMap,
  onSearchClick,
  onVerifyClick,
}) => {
  const [showPosterModal, setShowPosterModal] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0f2e22] via-[#1a4332] to-[#285740] text-white rounded-3xl shadow-2xl mb-8 border border-emerald-800/40">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 -mb-16 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 sm:px-8 lg:px-10">
        {/* Top Header Tags */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              National Land Governance Initiative
            </span>
            <span className="hidden sm:inline-block text-xs text-emerald-200/80">
              Azim Premji University &amp; Center for Land Governance
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              to="/officer"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 transition duration-150 border border-white/10 flex items-center gap-1"
            >
              <span>Officer Portal</span>
              <span className="text-amber-300">→</span>
            </Link>
            <Link
              to="/admin"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 transition duration-150 border border-white/10 flex items-center gap-1"
            >
              <span>Admin Portal</span>
              <span className="text-amber-300">→</span>
            </Link>
          </div>
        </div>

        {/* Main Hero Split Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8">
          {/* Left Text & Mission Details (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-900/60 border border-emerald-600/40 text-xs font-medium text-emerald-300">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                GIS-Integrated Land Tenure &amp; Administration
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                BhoomiSetu <span className="text-amber-400 font-normal">—</span> Land Governance Portal
              </h1>
              <p className="text-emerald-100/90 text-sm sm:text-base leading-relaxed pt-1">
                Bridging citizens, land records, and administration through modern spatial cadastre,
                satellite change detection, automated document verification, and unified ULPIN records.
              </p>
            </div>

            {/* Featured Workshop Highlight Card */}
            <div className="bg-emerald-950/70 border border-emerald-700/60 rounded-2xl p-5 shadow-inner backdrop-blur-sm relative group hover:border-amber-400/50 transition">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Featured Initiative • Workshop Spotlight
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Residential Workshop on Land Governance &amp; Development
                  </h3>
                  <p className="text-xs text-emerald-200/90 mt-1">
                    Organized by <strong className="text-white">Azim Premji University, Bengaluru</strong> &amp;{' '}
                    <strong className="text-white">Center for Land Governance</strong>
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-full">
                    Bengaluru Campus
                  </span>
                </div>
              </div>

              <p className="text-xs text-emerald-100/80 mt-3 line-clamp-3 leading-relaxed">
                "The land question is crucial for development and governance debates. Land tenure, governance, and usage are intertwined with climate change, food systems, livelihoods, empowerment, nutrition, and migration."
              </p>

              <div className="mt-4 pt-3 border-t border-emerald-800/80 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowPosterModal(true)}
                  className="text-xs text-amber-300 hover:text-amber-200 font-medium inline-flex items-center gap-1.5 transition underline-offset-4 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Full Event Poster &amp; Details
                </button>
                <a
                  href="https://forms.gle/EKewnpS14Ny3ySkq8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 bg-amber-400 text-emerald-950 font-semibold rounded-md hover:bg-amber-300 transition"
                >
                  Application Form ↗
                </a>
              </div>
            </div>

            {/* Quick Navigation Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onSearchClick ? onSearchClick() : scrollToSection('parcel-search-section');
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-emerald-950 font-semibold hover:bg-amber-300 shadow-lg shadow-amber-400/20 transition duration-150 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Cadastral Parcels
              </button>

              <button
                type="button"
                onClick={() => {
                  onExploreMap ? onExploreMap() : scrollToSection('map-view-section');
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-700/70 hover:bg-emerald-700 text-white font-medium border border-emerald-500/50 shadow transition duration-150 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Explore GIS Cadastre Map
              </button>

              <button
                type="button"
                onClick={() => {
                  onVerifyClick ? onVerifyClick() : scrollToSection('document-verification-section');
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 font-medium border border-white/20 transition duration-150 text-sm flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Verify Document
              </button>
            </div>
          </div>

          {/* Right Image Banner Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative group w-full max-w-md">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-emerald-500 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
              
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-emerald-500/40 shadow-2xl">
                <img
                  src="/land-governance-workshop.png"
                  alt="Land Governance & Development Workshop - Azim Premji University & Center for Land Governance"
                  className="w-full h-auto object-cover transform group-hover:scale-105 transition duration-500 cursor-pointer"
                  onClick={() => setShowPosterModal(true)}
                />
                
                {/* Overlay Action Bar */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex items-center justify-between">
                  <span className="text-xs text-gray-200 font-medium truncate max-w-[200px]">
                    Land Governance &amp; Development
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPosterModal(true)}
                    className="px-3 py-1 rounded-lg bg-amber-400 text-emerald-950 text-xs font-bold hover:bg-amber-300 transition shadow flex items-center gap-1"
                  >
                    <span>Enlarge Poster</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="text-center text-[11px] text-emerald-300/80 mt-2">
                Click image to view official workshop flyer &amp; institutional details
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-10 pt-6 border-t border-emerald-700/40 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-900/40 border border-emerald-700/30 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-400/20 text-amber-400 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Cadastral GIS Mapping</h4>
              <p className="text-xs text-emerald-200/80 mt-1">
                PostGIS spatial queries with bounding-box rendering, GeoJSON polygon outlines, and instant parcel identification.
              </p>
            </div>
          </div>

          <div className="bg-emerald-900/40 border border-emerald-700/30 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-400/20 text-emerald-300 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">AI Document Verification</h4>
              <p className="text-xs text-emerald-200/80 mt-1">
                Automated deed verification against canonical registry records with field-level confidence ratings and match verdicts.
              </p>
            </div>
          </div>

          <div className="bg-emerald-900/40 border border-emerald-700/30 rounded-xl p-4 flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-400/20 text-amber-300 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Multi-Role Governance</h4>
              <p className="text-xs text-emerald-200/80 mt-1">
                End-to-end service requests, mutation workflows, high-severity dispute alerts, and satellite change detection.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox / Modal for Full Poster Image */}
      {showPosterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowPosterModal(false)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-white">Land Governance Workshop Poster</h3>
                <p className="text-xs text-emerald-400">Azim Premji University &amp; Center for Land Governance</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPosterModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 max-h-[70vh] overflow-auto flex justify-center">
              <img
                src="/land-governance-workshop.png"
                alt="Full Poster: Residential Workshop on Land Governance and Development"
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between text-xs">
              <span className="text-gray-300">
                Workshop dates: <strong>July 3-7, 2023</strong> | Location: <strong>APU Bengaluru</strong>
              </span>
              <a
                href="https://forms.gle/EKewnpS14Ny3ySkq8"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-amber-400 text-emerald-950 font-bold rounded-lg hover:bg-amber-300 transition"
              >
                Open Application Form ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandGovernanceHero;
