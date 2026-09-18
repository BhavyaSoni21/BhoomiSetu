import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Search, Map as MapIcon, Layers, Info, Filter, Compass } from 'lucide-react';
import ParcelSearch from '../../features/parcels/ParcelSearch';
import UnifiedMapWrapper from '../../features/map/UnifiedMapWrapper';
import { ParcelSummary } from '../../types/parcel';
import BackButton from '../../components/BackButton';

const FindParcelsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchResults, setSearchResults] = useState<ParcelSummary[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'both' | 'map' | 'list'>('both');

  return (
    <div className="space-y-6 animate-fade-up">
      <BackButton />
      {/* ── Top Header & Guidance ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gov-border">
        <div>
          <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4 text-action-600" />
            <span>Geospatial Land Registry · SVAMITVA Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            {t('citizenPortal.findParcelsHeading', 'Find Land Parcels')}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Search by 14-digit ULPIN (Bhu-Aadhaar), survey number, plot number, or district.
          </p>
        </div>

        {/* View Mode Toggle (Mobile / Responsive) */}
        <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl border border-gov-border self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'both'
                ? 'bg-white text-text-heading shadow-sm font-bold'
                : 'text-text-muted hover:text-text-heading'
            }`}
          >
            Split View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'list'
                ? 'bg-white text-text-heading shadow-sm font-bold'
                : 'text-text-muted hover:text-text-heading'
            }`}
          >
            List Only
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'map'
                ? 'bg-white text-text-heading shadow-sm font-bold'
                : 'text-text-muted hover:text-text-heading'
            }`}
          >
            Map Only
          </button>
        </div>
      </div>

      {/* ── Main Layout: Search Panel + GIS Map ── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Search & Results Panel */}
        <div
          className={`${
            activeTab === 'map' ? 'hidden' : activeTab === 'list' ? 'lg:col-span-12' : 'lg:col-span-5'
          } space-y-4`}
        >
          <div className="gov-card p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gov-border">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-900 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-action-600" />
                Query Parameters
              </span>
              <span className="text-[11px] font-mono text-text-muted">
                {searchResults.length} {searchResults.length === 1 ? 'record' : 'records'} found
              </span>
            </div>
            <ParcelSearch
              onResultsChange={setSearchResults}
              selectedParcelId={selectedParcelId}
              onSelectParcel={setSelectedParcelId}
            />
          </div>
        </div>

        {/* GIS Map Panel */}
        <div
          className={`${
            activeTab === 'list' ? 'hidden' : activeTab === 'map' ? 'lg:col-span-12' : 'lg:col-span-7'
          } space-y-4`}
        >
          <div className="gov-card p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gov-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-900/10 text-brand-900 flex items-center justify-center">
                  <MapIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-heading font-bold text-text-heading">
                    {t('citizen.mapHeading', 'Cadastral GIS Map')}
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    Real-time GeoJSON boundaries with SVAMITVA drone overlays
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-green-100 text-green-800">
                EPSG:4326 WGS84
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border border-gov-border">
              <UnifiedMapWrapper
                parcels={searchResults}
                selectedParcelId={selectedParcelId}
                onParcelClick={setSelectedParcelId}
                showClusterDropdown
                hideStateDropdown
                showLayerPanel
                visibleLayerKeys={['zoning']}
                className="rounded-xl border border-gov-border"
                height="h-[500px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindParcelsPage;