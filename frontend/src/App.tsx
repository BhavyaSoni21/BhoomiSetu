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
import AskAiWidget from './features/ai/AskAiWidget';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
    isActive
      ? 'text-[#52b788] bg-[#142f24] font-semibold border-b-2 border-[#52b788]'
      : 'text-slate-300 hover:text-white hover:bg-white/5'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2.5 rounded-lg text-base font-medium ${
    isActive ? 'bg-[#142f24] text-[#52b788]' : 'text-slate-300 hover:text-white hover:bg-white/5'
  }`;

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const [language, setLanguage] = useState('English');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));

  useEffect(() => {
    setMobileMenuOpen(false);
    setAppsMenuOpen(false);
    setToken(localStorage.getItem('access_token'));
  }, [location.pathname]);

  const handleNavbarSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/parcels/search?local_identifier=${encodeURIComponent(query)}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    setToken(null);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#f5f6f2] flex flex-col font-sans">
      {/* Top Utility Bar with Official Government Touch */}
      <div className="bg-[#08150f] text-emerald-100/80 text-xs py-2 px-4 sm:px-6 lg:px-8 border-b border-[#1b3d2e]/80">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Indian National Flag & Government Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* Tricolor stripe indicator */}
              <div className="flex flex-col w-3.5 h-3 rounded-xs overflow-hidden shadow-xs border border-white/20">
                <div className="h-1 bg-[#ff9933]"></div>
                <div className="h-1 bg-[#ffffff]"></div>
                <div className="h-1 bg-[#138808]"></div>
              </div>
              <span className="font-semibold text-white tracking-wide text-[11px] sm:text-xs">
                भारत सरकार <span className="text-emerald-400 font-normal">|</span> Government of India
              </span>
            </div>
            <span className="hidden md:inline text-emerald-800">•</span>
            <span className="hidden md:inline text-emerald-200/60 text-[11px]">
              भू-अभिलेख एवं राजस्व प्रशासन पोर्टल (Bhu-Aadhaar Integrated)
            </span>
          </div>

          {/* Right: Citizen Helpline & Sign In */}
          <div className="flex items-center gap-4 text-[11px] sm:text-xs">
            <span className="hidden sm:flex items-center gap-1.5 text-emerald-200/90">
              <svg className="w-3.5 h-3.5 text-[#e59866]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>टोल-फ्री हेल्पलाइन: <strong>1800-11-2026</strong></span>
            </span>

            <span className="text-emerald-900 hidden sm:inline">|</span>

            {/* Language Selector */}
            <div className="flex items-center gap-1">
              <select
                aria-label="Language selection"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-emerald-100 hover:text-white cursor-pointer focus:outline-none text-[11px] sm:text-xs font-medium"
              >
                <option value="English" className="bg-[#0e241b] text-white">English</option>
                <option value="Hindi" className="bg-[#0e241b] text-white">हिंदी (Hindi)</option>
                <option value="Marathi" className="bg-[#0e241b] text-white">मराठी (Marathi)</option>
                <option value="Kannada" className="bg-[#0e241b] text-white">ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>

            <span className="text-emerald-900">|</span>

            {token ? (
              <button
                type="button"
                onClick={handleLogout}
                className="text-emerald-200 hover:text-[#e59866] font-medium transition"
              >
                लॉग आउट (Sign Out)
              </button>
            ) : (
              <Link
                to="/login"
                className="text-emerald-200 hover:text-[#e59866] font-medium transition flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5 text-[#e59866]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>अधिकारी लॉगिन (Sign In)</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar with Clean Spacing & Proper Proportions */}
      <header className="bg-[#0e241b] border-b border-[#1b3d2e] sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 sm:h-22">
            {/* Left: Official Logo + Clear Human Brand Identity */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3.5 group">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-1 flex items-center justify-center shadow-md border-2 border-[#2d6a4f]/30 group-hover:scale-105 transition-transform shrink-0">
                  <img
                    src="/bhoomisetu-logo.png"
                    alt="BhoomiSetu Official Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl sm:text-[26px] font-black tracking-tight font-display text-white">
                      <span className="text-[#52b788]">Bhoomi</span>
                      <span className="text-[#e59866]">Setu</span>
                    </span>
                    <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#7c3f1d]/30 text-[#e59866] border border-[#7c3f1d]/50 font-bold text-[10px] tracking-wider uppercase">
                      राष्ट्रीय भू-पोर्टल
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs text-emerald-200/80 font-normal mt-0.5">
                    ज़मीन एक, जानकारी अनेक, जोड़ता है BhoomiSetu
                  </span>
                </div>
              </Link>
            </div>

            {/* Center: Desktop Navigation Links with Generous Padding */}
            <nav className="hidden lg:flex items-center space-x-2">
              <NavLink to="/" end className={navLinkClass}>
                Home
              </NavLink>
              <NavLink to="/citizen" className={navLinkClass}>
                Citizen Portal
              </NavLink>
              <NavLink to="/officer" className={navLinkClass}>
                Officer Portal
              </NavLink>
              <NavLink to="/admin" className={navLinkClass}>
                Admin Portal
              </NavLink>
            </nav>

            {/* Right: Search + Action Button + App Launcher */}
            <div className="flex items-center gap-3 sm:gap-4">
              <form onSubmit={handleNavbarSearch} className="relative hidden xl:block w-52">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2 bg-[#142f24] border border-[#234e3b] rounded-xl text-xs text-white placeholder-emerald-200/50 focus:outline-none focus:border-[#52b788] transition"
                  placeholder="Search Survey or Plot No..."
                />
                <button type="submit" aria-label="Search local identifier" className="absolute right-2.5 top-2.5 text-emerald-300 hover:text-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </form>

              {/* Terracotta Soil Clay CTA Button */}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('parcel-search-section');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    navigate('/citizen');
                  }
                }}
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3f1d] via-[#935116] to-[#b36b28] hover:from-[#6b3518] hover:to-[#8c4915] text-white font-bold text-xs sm:text-sm shadow-md border border-[#c68b59]/30 transition duration-150 cursor-pointer"
              >
                <span>Search Records</span>
                <span className="text-[#e59866]">→</span>
              </button>

              {/* Quick Module Switcher Grid Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAppsMenuOpen((prev) => !prev)}
                  className="w-10 h-10 rounded-xl bg-[#142f24] border border-[#234e3b] hover:bg-[#1a3d2e] text-emerald-200 hover:text-white flex items-center justify-center transition shadow-sm"
                  aria-label="App Switcher"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>

                {appsMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0e241b] border border-[#234e3b] shadow-2xl p-3 z-50 text-white space-y-2">
                    <div className="text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider px-2">
                      Portals &amp; Public Services
                    </div>
                    <Link
                      to="/citizen"
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#142f24] transition"
                      onClick={() => setAppsMenuOpen(false)}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#2d6a4f]/30 text-[#52b788] flex items-center justify-center font-bold text-base border border-[#2d6a4f]/40">
                        🌿
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Citizen Portal</div>
                        <div className="text-[10px] text-emerald-200/70">Search land, view maps, verify documents</div>
                      </div>
                    </Link>
                    <Link
                      to="/officer"
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#142f24] transition"
                      onClick={() => setAppsMenuOpen(false)}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#7c3f1d]/30 text-[#e59866] flex items-center justify-center font-bold text-base border border-[#7c3f1d]/40">
                        🛡️
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Revenue Officer Portal</div>
                        <div className="text-[10px] text-emerald-200/70">Mutation approvals, reviews, alerts</div>
                      </div>
                    </Link>
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#142f24] transition"
                      onClick={() => setAppsMenuOpen(false)}
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#935116]/30 text-[#c68b59] flex items-center justify-center font-bold text-base border border-[#935116]/40">
                        ⚙️
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Administration Portal</div>
                        <div className="text-[10px] text-emerald-200/70">Staff access, audit records, district stats</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-emerald-300 hover:text-white hover:bg-white/5 focus:outline-none"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t border-[#1b3d2e] bg-[#0e241b] px-4 pt-3 pb-5 space-y-2">
            <NavLink to="/" end className={mobileNavLinkClass}>
              Home
            </NavLink>
            <NavLink to="/citizen" className={mobileNavLinkClass}>
              Citizen Portal
            </NavLink>
            <NavLink to="/officer" className={mobileNavLinkClass}>
              Officer Portal
            </NavLink>
            <NavLink to="/admin" className={mobileNavLinkClass}>
              Admin Portal
            </NavLink>
            <form onSubmit={handleNavbarSearch} className="pt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full px-3 py-2 bg-[#142f24] border border-[#234e3b] rounded-lg text-sm text-white placeholder-emerald-200/50 focus:outline-none focus:border-[#52b788]"
                placeholder="Search parcels by local identifier..."
              />
            </form>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<CitizenPortal />} />
          <Route path="/citizen" element={<CitizenPortal />} />
          <Route
            path="/officer"
            element={
              <RequireAuth roles={OFFICER_ROLES}>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <OfficerPortal />
                </div>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['ADMIN']}>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <AdminPortal />
                </div>
              </RequireAuth>
            }
          />
          <Route
            path="/login"
            element={
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <LoginPage />
              </div>
            }
          />
          <Route
            path="/parcels/search"
            element={
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <ParcelSearch />
              </div>
            }
          />
          <Route
            path="/parcels/:id"
            element={
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <Parcel360View />
              </div>
            }
          />
          <Route
            path="/map"
            element={
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <MapComponent />
              </div>
            }
          />
        </Routes>
      </main>

      {/* Floating Ask AI Widget for Citizen & Public Views */}
      {!location.pathname.startsWith('/officer') && !location.pathname.startsWith('/admin') && location.pathname !== '/login' && (
        <AskAiWidget />
      )}
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