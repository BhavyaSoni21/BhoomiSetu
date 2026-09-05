import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import ParcelSearch from './features/parcels/ParcelSearch';
import Parcel360View from './features/parcels/Parcel360View';
import MapComponent from './features/map/MapComponent';
import CitizenPortal from './pages/CitizenPortal';
import OfficerPortal from './pages/OfficerPortal';
import AdminPortal from './pages/AdminPortal';
import LoginPage from './pages/LoginPage';
import RequireAuth from './features/auth/RequireAuth';
import { OFFICER_ROLES } from './features/officer/officerAuth';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-base font-medium ${
    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'
  }`;

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // A route change (including via a mobile nav link) should always close the
  // menu - otherwise it stays open over the newly-navigated-to page.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
            <div className="flex items-center gap-2">
              <form onSubmit={handleNavbarSearch} className="relative hidden sm:block">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Search parcels by local identifier..."
                />
              </form>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <NavLink to="/citizen" className={mobileNavLinkClass}>
                Citizen Portal
              </NavLink>
              <NavLink to="/officer" className={mobileNavLinkClass}>
                Officer Portal
              </NavLink>
              <NavLink to="/admin" className={mobileNavLinkClass}>
                Admin Portal
              </NavLink>
            </div>
            <form onSubmit={handleNavbarSearch} className="px-4 pb-4 sm:hidden">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-4 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Search parcels by local identifier..."
              />
            </form>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<CitizenPortal />} />
            <Route path="/citizen" element={<CitizenPortal />} />
            <Route
              path="/officer"
              element={
                <RequireAuth roles={OFFICER_ROLES}>
                  <OfficerPortal />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth roles={['ADMIN']}>
                  <AdminPortal />
                </RequireAuth>
              }
            />
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