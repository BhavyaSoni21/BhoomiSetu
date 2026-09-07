import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag, Inbox } from 'lucide-react';
import ParcelSearch from '../features/parcels/ParcelSearch';
import MapComponent from '../features/map/MapComponent';
import DocumentVerificationPanel from '../features/document-verification/DocumentVerificationPanel';
import MyParcels from '../features/citizen/MyParcels';
import LandingHero from '../features/citizen/LandingHero';
import { useAuthUser } from '../features/auth/auth';
import { ParcelSummary } from '../types/parcel';

interface ComingSoonCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accentClass: string;
}

// Rule 8 (docs/flow.md): a feature that isn't built yet gets a visibly
// "coming soon" placeholder in the layout - never a working-looking control
// with nothing behind it. Reduced opacity + a badge + no click handler on
// anything inside signal "not open yet" rather than "broken".
const ComingSoonCard: React.FC<ComingSoonCardProps> = ({ icon: Icon, title, description, accentClass }) => {
  const { t } = useTranslation();
  return (
    <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6 opacity-70">
      <span className={`absolute -top-3 -right-3 w-6 h-6 rounded-full ${accentClass} border-2 border-ink`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 border-2 border-ink bg-muted flex items-center justify-center text-ink/50 shrink-0">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink/70 leading-tight">{title}</h2>
        </div>
        <span className="shrink-0 px-2 py-0.5 bg-accent text-ink border-2 border-ink text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
          {t('placeholders.comingSoonBadge')}
        </span>
      </div>
      <p className="text-sm text-ink/50 leading-relaxed">{description}</p>
    </div>
  );
};

const CitizenPortal: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  const isCitizen = user?.role === 'CITIZEN';
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-12 pt-10">
        {/* My Parcels (Built) + Land Claim / My Requests (Placeholder, citizens only) */}
        <div id="my-parcels-section" className="grid gap-6 lg:grid-cols-3 items-stretch">
          <div className={isCitizen ? 'lg:col-span-1' : 'lg:col-span-3'}>
            <MyParcels />
          </div>
          {isCitizen && (
            <>
              <ComingSoonCard
                icon={Flag}
                title={t('placeholders.landClaimTitle')}
                description={t('placeholders.landClaimDesc')}
                accentClass="bg-secondary"
              />
              <ComingSoonCard
                icon={Inbox}
                title={t('placeholders.myRequestsTitle')}
                description={t('placeholders.myRequestsDesc')}
                accentClass="bg-primary"
              />
            </>
          )}
        </div>

        {/* Search & Map Two-Column Section */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Parcel Search Column */}
          <div id="parcel-search-section" className="scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-secondary" aria-hidden="true" />
                <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">
                  {t('citizen.searchHeading')}
                </h2>
              </div>
              <span className="text-xs font-mono font-bold text-secondary bg-secondary/10 border-2 border-secondary/30 px-2.5 py-1">
                {t('citizen.searchTag')}
              </span>
            </div>
            <p className="text-xs text-ink/60 mb-3">
              {t('citizen.searchDesc')}
            </p>
            <ParcelSearch
              onResultsChange={setSearchResults}
              selectedParcelId={selectedParcelId}
              onSelectParcel={setSelectedParcelId}
            />
          </div>

          {/* Satellite Map Column */}
          <div id="map-view-section" className="scroll-mt-28">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-primary" aria-hidden="true" />
                <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">
                  {t('citizen.mapHeading')}
                </h2>
              </div>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 border-2 border-primary/30 px-2.5 py-1">
                {t('citizen.mapTag')}
              </span>
            </div>
            <p className="text-xs text-ink/60 mb-3">
              {t('citizen.mapDesc')}
            </p>
            <MapComponent
              parcels={searchResults}
              selectedParcelId={selectedParcelId}
              onParcelClick={setSelectedParcelId}
            />
          </div>
        </div>

        {/* Document Verification Section */}
        <div id="document-verification-section" className="scroll-mt-28">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full bg-accent" aria-hidden="true" />
              <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">
                {t('citizen.verifyHeading')}
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-secondary-strong bg-accent/10 border-2 border-accent/40 px-2.5 py-1">
              {t('citizen.verifyTag')}
            </span>
          </div>
          <p className="text-xs text-ink/60 mb-3">
            {t('citizen.verifyDesc')}
          </p>
          <DocumentVerificationPanel selectedParcelId={selectedParcelId} />
        </div>
      </div>
    </div>
  );
};

export default CitizenPortal;
