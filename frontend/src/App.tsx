import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import ParcelSearch from './features/parcels/ParcelSearch';
import Parcel360View from './features/parcels/Parcel360View';
import MapComponent from './features/map/MapComponent';
import CitizenPortal from './pages/CitizenPortal';
import OfficerPortal from './pages/OfficerPortal';
import AdminPortal from './pages/AdminPortal';
import LoginPage from './pages/LoginPage';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
  }`;

function AppShell() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleNavbarSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/parcels/search?local_identifier=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-xl font-semibold text-gray-800">
                  BhoomiSetu
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <NavLink to="/citizen" className={navLinkClass}>
                    Citizen Portal
                  </NavLink>
                  <NavLink to="/officer" className={navLinkClass}>
                    Officer Portal
                  </NavLink>
                  <NavLink to="/admin" className={navLinkClass}>
                    Admin Portal
                  </NavLink>
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <form onSubmit={handleNavbarSearch} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Search parcels by local identifier..."
                />
              </form>
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
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;