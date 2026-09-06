import React, { useState } from 'react';
import ParcelSearch from '../features/parcels/ParcelSearch';
import MapComponent from '../features/map/MapComponent';
import DocumentVerificationPanel from '../features/document-verification/DocumentVerificationPanel';
import MyParcels from '../features/citizen/MyParcels';
import LandingHero from '../features/citizen/LandingHero';
import { ParcelSummary } from '../types/parcel';

const CitizenPortal: React.FC = () => {
  const [searchResults, setSearchResults] = useState<ParcelSummary[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  const handleScroll = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full">
      {/* Humanized Hero with Indian Gov Touch & Earthy Palette */}
      <LandingHero
        onSearchClick={() => handleScroll('parcel-search-section')}
        onExploreMap={() => handleScroll('map-view-section')}
        onVerifyClick={() => handleScroll('document-verification-section')}
      />

      {/* Main Content Container below Hero with Generous Spacing */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12 pt-6">
        {/* Linked Parcels / Citizen Header */}
        <div id="my-parcels-section">
          <MyParcels />
        </div>

        {/* Search & Map Two-Column Section */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Parcel Search Column */}
          <div id="parcel-search-section" className="scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#7c3f1d] shadow-sm"></span>
                <h2 className="text-xl font-bold text-[#1b4332] font-display">
                  Search Land Records
                </h2>
              </div>
              <span className="text-xs font-mono text-[#7c3f1d] font-semibold bg-[#7c3f1d]/10 px-2.5 py-1 rounded-md">
                ULPIN / Khasra / Survey
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Type your 14-digit Bhu-Aadhaar, survey number, or plot number to pull up ownership and mutation status.
            </p>
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-[#dce4d8] p-6">
              <ParcelSearch
                onResultsChange={setSearchResults}
                selectedParcelId={selectedParcelId}
                onSelectParcel={setSelectedParcelId}
              />
            </div>
          </div>

          {/* Satellite Map Column */}
          <div id="map-view-section" className="scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#2d6a4f] shadow-sm"></span>
                <h2 className="text-xl font-bold text-[#1b4332] font-display">
                  Satellite Boundary Map
                </h2>
              </div>
              <span className="text-xs font-mono text-[#2d6a4f] font-semibold bg-[#2d6a4f]/10 px-2.5 py-1 rounded-md">
                Cadastral Survey Layer
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Click directly on any plot outline on the map to see boundary coordinates, area in hectares, and road connectivity.
            </p>
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-[#dce4d8] p-6 overflow-hidden">
              <MapComponent
                parcels={searchResults}
                selectedParcelId={selectedParcelId}
                onParcelClick={setSelectedParcelId}
              />
            </div>
          </div>
        </div>

        {/* Document Verification Section */}
        <div id="document-verification-section" className="scroll-mt-28">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-[#935116] shadow-sm"></span>
              <h2 className="text-xl font-bold text-[#1b4332] font-display">
                Verify Your Land Papers
              </h2>
            </div>
            <span className="text-xs font-mono text-[#935116] font-semibold bg-[#935116]/10 px-2.5 py-1 rounded-md">
              7/12 Extract &amp; Deed Match
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Upload a clear photo or PDF of your registered sale deed or 7/12 extract. We check if the owner names and plot numbers match government records.
          </p>
          <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-[#dce4d8] p-6">
            <DocumentVerificationPanel selectedParcelId={selectedParcelId} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenPortal;
