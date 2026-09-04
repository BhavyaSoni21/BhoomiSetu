import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ParcelSearch from './features/parcels/ParcelSearch';
import Parcel360View from './features/parcels/Parcel360View';
import MapComponent from './features/map/MapComponent';
import CitizenPortal from './pages/CitizenPortal';
import OfficerPortal from './pages/OfficerPortal';
import AdminPortal from './pages/AdminPortal';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0">
                  <h1 className="text-xl font-semibold text-gray-800">
                    BhoomiSetu
                  </h1>
                </div>
                <div className="hidden md:block">
                  <div className="ml-10 flex items-baseline space-x-4">
                    <a href="#" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                      Citizen Portal
                    </a>
                    <a href="#" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                      Officer Portal
                    </a>
                    <a href="#" className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
                      Admin Portal
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    {/* <!-- Search icon would go here --> */}
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Search parcels..."
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<CitizenPortal />} />
              <Route path="/citizen" element={<CitizenPortal />} />
              <Route path="/officer" element={<OfficerPortal />} />
              <Route path="/admin" element={<AdminPortal />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/parcels/search" element={<ParcelSearch />} />
              <Route path="/parcels/:id" element={<Parcel360View />} />
              <Route path="/map" element={<MapComponent />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;