import React, { useState } from 'react';
import ParcelSearch from '../features/parcels/ParcelSearch';
import MapComponent from '../features/map/MapComponent';
import AiParcelSearch from '../features/ai/AiParcelSearch';
import { ParcelSummary } from '../types/parcel';

const CitizenPortal: React.FC = () => {
  const [searchResults, setSearchResults] = useState<ParcelSummary[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Citizen Portal</h1>
      <AiParcelSearch />
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-2">Parcel Search</h2>
          <ParcelSearch
            onResultsChange={setSearchResults}
            selectedParcelId={selectedParcelId}
            onSelectParcel={setSelectedParcelId}
          />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Map View</h2>
          <MapComponent
            parcels={searchResults}
            selectedParcelId={selectedParcelId}
            onParcelClick={setSelectedParcelId}
          />
        </div>
      </div>
    </div>
  );
};

export default CitizenPortal;
