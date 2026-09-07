import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Circle, Square, Triangle, Menu, X, Search, ArrowRight, Moon, Sun, LayoutGrid, Phone } from 'lucide-react';
import ParcelSearch from './features/parcels/ParcelSearch';
import Parcel360View from './features/parcels/Parcel360View';
import MapComponent from './features/map/MapComponent';
import CitizenPortal from './pages/CitizenPortal';
import OfficerPortal from './pages/OfficerPortal';
import AdminPortal from './pages/AdminPortal';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RequireAuth from './features/auth/RequireAuth';
import { useAuthUser, useLogout } from './features/auth/auth';
import { OFFICER_ROLES } from './features/officer/officerAuth';
import AskAiWidget from './features/ai/AskAiWidget';
import { SUPPORTED_LANGUAGES, SupportedLanguage, setStoredLanguage } from './i18n/config';
import { useTheme } from './theme/theme';

// Role-shape wayfinding (docs/design.md §2): circle=Citizen (primary/green),
// square=Officer (secondary/terracotta), triangle=Admin (accent/gold) - used
// consistently across the nav, app switcher, and portal cards.
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3.5 py-2 text-sm font-bold uppercase tracking-wide transition-colors duration-150 border-b-2 ${
    isActive ? 'text-primary border-primary' : 'text-white/80 border-transparent hover:text-white hover:border-white/30'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2.5 text-base font-bold uppercase tracking-wide border-l-4 ${
    isActive ? 'bg-bhoomi-card text-primary border-primary' : 'text-white/80 border-transparent hover:text-white hover:bg-bhoomi-card'
  }`;

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  // Backed by the same React Query-cached auth state RequireAuth reads
  // (features/auth/auth.ts) rather than a separate localStorage read, so
  // signing out here actually clears the cache every route guard shares -
  // a plain localStorage.removeItem would leave /officer and /admin still
  // rendering from the stale cached user until a full page reload.
  const { data: authUser } = useAuthUser();
  const logout = useLogout();

  useEffect(() => {
    setMobileMenuOpen(false);
    setAppsMenuOpen(false);
  }, [location.pathname]);

  const handleNavbarSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/parcels/search?local_identifier=${encodeURIComponent(query)}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleLanguageChange = (next: SupportedLanguage) => {
    i18n.changeLanguage(next);
    setStoredLanguage(next);
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top Utility Bar with Official Government Touch */}
      <div className="bg-bhoomi-dark text-white/80 text-xs py-2 px-4 sm:px-6 lg:px-8 border-b-2 border-ink">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Indian National Flag & Government Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* Tricolor stripe indicator */}
              <div className="flex flex-col w-4 h-3 overflow-hidden border border-white/40">
                <div className="h-1 bg-[#ff9933]"></div>
                <div className="h-1 bg-white"></div>
                <div className="h-1 bg-[#138808]"></div>
              </div>
              <span className="font-bold text-white tracking-wide text-[11px] sm:text-xs uppercase">
                {t('nav.govtLine')}
              </span>
            </div>
            <span className="hidden md:inline text-white/30">•</span>
            <span className="hidden md:inline text-white/60 text-[11px]">
              {t('nav.portalTagline')}
            </span>
          </div>

          {/* Right: Citizen Helpline, Language, Theme, Sign In */}
          <div className="flex items-center gap-4 text-[11px] sm:text-xs">
            <span className="hidden sm:flex items-center gap-1.5 text-white/90">
              <Phone className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>{t('nav.helpline')}: <strong>1800-11-2026</strong></span>
            </span>

            <span className="text-white/20 hidden sm:inline">|</span>

            {/* Language Selector */}
            <select
              aria-label={t('nav.languageSelectLabel')}
              value={i18n.language}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              className="bg-transparent text-white/90 hover:text-white cursor-pointer focus:outline-none text-[11px] sm:text-xs font-bold"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang} className="bg-bhoomi-spruce text-white">
                  {lang === 'Hindi' ? 'हिंदी (Hindi)' : lang}
                </option>
              ))}
            </select>

            <span className="text-white/20">|</span>

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('nav.themeToggleToLight') : t('nav.themeToggleToDark')}
              className="text-white/80 hover:text-accent transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <span className="text-white/20">|</span>

            {authUser ? (
              <button type="button" onClick={handleLogout} className="text-white/90 hover:text-accent font-bold transition">
                {t('nav.signOut')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-white/90 hover:text-accent font-bold transition">
                  {t('nav.signIn')}
                </Link>
                <span className="text-white/20">/</span>
                <Link to="/register" className="text-white/90 hover:text-accent font-bold transition">
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className="bg-bhoomi-spruce border-b-4 border-ink sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 sm:h-22">
            {/* Left: Official Logo + Brand Identity */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3.5 group">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white p-1 flex items-center justify-center border-2 border-ink shadow-hard-sm shrink-0">
                  <img src="/bhoomisetu-logo.png" alt={t('nav.logoAlt')} className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl sm:text-[26px] font-black tracking-tight font-display text-white">
                      <span className="text-primary">Bhoomi</span>
                      <span className="text-secondary">Setu</span>
                    </span>
                    <span className="hidden sm:inline-block px-2.5 py-0.5 bg-secondary/20 text-accent border border-secondary/50 font-bold text-[10px] tracking-wider uppercase">
                      {t('nav.badge')}
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs text-white/60 font-medium mt-0.5">
                    {t('nav.brandTagline')}
                  </span>
                </div>
              </Link>
            </div>

            {/* Center: Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              <NavLink to="/" end className={navLinkClass}>
                {t('nav.home')}
              </NavLink>
              <NavLink to="/citizen" className={navLinkClass}>
                <span className="inline-flex items-center gap-1.5">
                  <Circle className="w-3 h-3 fill-current" aria-hidden="true" />
                  {t('nav.citizenPortal')}
                </span>
              </NavLink>
              <NavLink to="/officer" className={navLinkClass}>
                <span className="inline-flex items-center gap-1.5">
                  <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                  {t('nav.officerPortal')}
                </span>
              </NavLink>
              <NavLink to="/admin" className={navLinkClass}>
                <span className="inline-flex items-center gap-1.5">
                  <Triangle className="w-3 h-3 fill-current" aria-hidden="true" />
                  {t('nav.adminPortal')}
                </span>
              </NavLink>
            </nav>

            {/* Right: Search + Action Button + App Launcher */}
            <div className="flex items-center gap-3 sm:gap-4">
              <form onSubmit={handleNavbarSearch} className="relative hidden xl:block w-52">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2 bg-bhoomi-card border-2 border-ink text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary transition"
                  placeholder={t('nav.searchPlaceholder')}
                />
                <button type="submit" aria-label={t('nav.searchAriaLabel')} className="absolute right-2.5 top-2.5 text-white/60 hover:text-white">
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </form>

              {/* Soil-clay CTA Button */}
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
                className="hidden sm:flex items-center gap-2 rounded-full px-4 py-2.5 bg-secondary hover:bg-secondary-strong text-white font-bold text-xs sm:text-sm border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
              >
                <span>{t('nav.searchRecordsCta')}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              {/* Quick Module Switcher Grid Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAppsMenuOpen((prev) => !prev)}
                  className="w-10 h-10 bg-bhoomi-card border-2 border-ink hover:bg-bhoomi-border text-white/80 hover:text-white flex items-center justify-center transition"
                  aria-label={t('nav.appSwitcherAriaLabel')}
                >
                  <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                </button>

                {appsMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-bhoomi-spruce border-4 border-ink shadow-hard-lg p-3 z-50 text-white space-y-2">
                    <div className="text-[11px] font-bold text-white/60 uppercase tracking-wider px-2">
                      {t('nav.portalsHeading')}
                    </div>
                    <Link
                      to="/citizen"
                      className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-primary hover:bg-bhoomi-card transition"
                      onClick={() => setAppsMenuOpen(false)}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center border-2 border-primary/50">
                        <Circle className="w-4 h-4 fill-current" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{t('nav.citizenPortal')}</div>
                        <div className="text-[10px] text-white/60">{t('nav.citizenPortalDesc')}</div>
                      </div>
                    </Link>
                    <Link
                      to="/officer"
                      className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-secondary hover:bg-bhoomi-card transition"
                      onClick={() => setAppsMenuOpen(false)}
                    >
                      <div className="w-9 h-9 bg-secondary/20 text-secondary flex items-center justify-center border-2 border-secondary/50">
                        <Square className="w-4 h-4 fill-current" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{t('nav.officerPortalName')}</div>
                        <div className="text-[10px] text-white/60">{t('nav.officerPortalDesc')}</div>
                      </div>
                    </Link>
                    <Link
                      to="/admin"
                      className="flex items-center gap-3 p-2.5 border-2 border-transparent hover:border-accent hover:bg-bhoomi-card transition"
                      onClick={() => setAppsMenuOpen(false)}
                    >
                      <div className="w-9 h-9 bg-accent/20 text-accent flex items-center justify-center border-2 border-accent/50">
                        <Triangle className="w-4 h-4 fill-current" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{t('nav.adminPortalName')}</div>
                        <div className="text-[10px] text-white/60">{t('nav.adminPortalDesc')}</div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="lg:hidden inline-flex items-center justify-center p-2 text-white/80 hover:text-white hover:bg-bhoomi-card focus:outline-none"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                aria-label={t('nav.toggleMenuAriaLabel')}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t-2 border-ink bg-bhoomi-spruce px-4 pt-3 pb-5 space-y-1">
            <NavLink to="/" end className={mobileNavLinkClass}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/citizen" className={mobileNavLinkClass}>
              {t('nav.citizenPortal')}
            </NavLink>
            <NavLink to="/officer" className={mobileNavLinkClass}>
              {t('nav.officerPortal')}
            </NavLink>
            <NavLink to="/admin" className={mobileNavLinkClass}>
              {t('nav.adminPortal')}
            </NavLink>
            <form onSubmit={handleNavbarSearch} className="pt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full px-3 py-2 bg-bhoomi-card border-2 border-ink text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary"
                placeholder={t('nav.searchPlaceholderMobile')}
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
      {!location.pathname.startsWith('/officer') && !location.pathname.startsWith('/admin') && !isAuthPage && (
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
