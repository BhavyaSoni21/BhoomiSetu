import React from 'react';
import ParcelSearch from '../features/parcels/ParcelSearch';
import MapComponent from '../features/map/MapComponent';

const CitizenPortal: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Citizen Portal</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-2">Parcel Search</h2>
          <ParcelSearch />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Map View</h2>
          <MapComponent />
        </div>
      </div>
    </div>
  );
};

export default CitizenPortal;