import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ParcelSearch from '../../features/parcels/ParcelSearch';
import MapComponent from '../../features/map/MapComponent';
import { ParcelSummary } from '../../types/parcel';

// Search + map, moved as-is from the old single-page CitizenPortal.tsx into
// its own Citizen Portal page (docs/FRONTEND_UPGRADE_SPEC.md §1/§4 - search
// happens post-login now, never for a guest).
const FindParcelsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchResults, setSearchResults] = useState<ParcelSummary[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink mb-1">
          {t('citizenPortal.findParcelsHeading')}
        </h1>
        <p className="text-xs text-ink/60 mb-3">{t('citizenPortal.findParcelsDesc')}</p>
        <ParcelSearch onResultsChange={setSearchResults} selectedParcelId={selectedParcelId} onSelectParcel={setSelectedParcelId} />
      </div>
      <div>
        <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink mb-1">
          {t('citizen.mapHeading')}
        </h2>
        <p className="text-xs text-ink/60 mb-3">{t('citizen.mapDesc')}</p>
        <MapComponent parcels={searchResults} selectedParcelId={selectedParcelId} onParcelClick={setSelectedParcelId} />
      </div>
    </div>
  );
};

export default FindParcelsPage;
