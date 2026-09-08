import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight, Moon, Sun, Phone } from 'lucide-react';
import Parcel360View from './features/parcels/Parcel360View';
import HomePage from './pages/HomePage';
import CitizenPortal from './pages/CitizenPortal';
import OfficerPortal from './pages/OfficerPortal';
import AdminPortal from './pages/AdminPortal';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import RequireAuth from './features/auth/RequireAuth';
import { useAuthUser, useLogout } from './features/auth/auth';
import { OFFICER_ROLES } from './features/officer/officerAuth';
import AskAiWidget from './features/ai/AskAiWidget';
import { SUPPORTED_LANGUAGES, SupportedLanguage, setStoredLanguage } from './i18n/config';
import { useTheme } from './theme/theme';
import { NavItem, CITIZEN_NAV_ITEMS, OFFICER_NAV_ITEMS } from './navConfig';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-3.5 py-2 text-sm font-bold uppercase tracking-wide transition-colors duration-150 border-b-2 whitespace-nowrap ${
    isActive ? 'text-primary border-primary' : 'text-white/80 border-transparent hover:text-white hover:border-white/30'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2.5 text-base font-bold uppercase tracking-wide border-l-4 ${
    isActive ? 'bg-bhoomi-card text-primary border-primary' : 'text-white/80 border-transparent hover:text-white hover:bg-bhoomi-card'
  }`;

// One navbar, everywhere - no separate portal-owned sub-nav any more (the
// user's explicit follow-up: "i dont want 2 diffrent navbars fit the things
// in the orignal navbar only"). CitizenPortal.tsx/OfficerPortal.tsx are now
// just their own <Routes>; every page they used to link to via their own tab
// bar is listed here instead (navConfig.ts) and rendered in this same header
// row guests already had. A guest still gets Home/About/Features; a citizen
// additionally gets Home/About (per the user's explicit "citizens should be
// able to see the home and about page") plus their full portal page list; an
// officer gets their portal page list only (not asked to see Home/About);
// admin is unchanged (still a single link - Admin Portal hasn't been split
// into multiple pages yet, Phase 3).
function navItemsFor(role: string | undefined): NavItem[] {
  const home: NavItem = { to: '/', end: true, labelKey: 'nav.home' };
  const about: NavItem = { to: '/about', labelKey: 'nav.about' };
  if (!role) return [home, about, { to: '/features', labelKey: 'nav.features' }];
  if (role === 'CITIZEN') return [home, about, ...CITIZEN_NAV_ITEMS];
  if (role === 'ADMIN') return [{ to: '/admin', end: true, labelKey: 'nav.adminPortal' }];
  return OFFICER_NAV_ITEMS; // one of the 4 OFFICER_ROLES
}

function portalPathForRole(role: string): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'CITIZEN') return '/citizen';
  return '/officer'; // one of the 4 OFFICER_ROLES
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  // Backed by the same React Query-cached auth state RequireAuth reads
  // (features/auth/auth.ts) rather than a separate localStorage read, so
  // signing out here actually clears the cache every route guard shares -
  // a plain localStorage.removeItem would leave /officer and /admin still
  // rendering from the stale cached user until a full page reload.
  const { data: authUser } = useAuthUser();
  const logout = useLogout();
  const isGuest = !authUser;
  const isCitizen = authUser?.role === 'CITIZEN';
  const navItems = navItemsFor(authUser?.role);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

      {/* Main Navigation Bar - a single row, no logo (moved to the Home
          page's hero - see LandingHero.tsx), listing whichever pages this
          visitor can actually reach (navItemsFor above). Horizontally
          scrollable rather than wrapping, since a signed-in citizen's full
          page list (11 items) doesn't fit one line at every width. */}
      <header className="bg-bhoomi-spruce border-b-4 border-ink sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.labelKey ? t(item.labelKey) : item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right: Get Started (guest only) + the mobile toggle */}
            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
              {isGuest && (
                <Link
                  to="/register"
                  className="hidden sm:flex items-center gap-2 rounded-full px-4 py-2.5 bg-secondary hover:bg-secondary-strong text-white font-bold text-xs sm:text-sm border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                >
                  <span>{t('nav.getStarted')}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              )}

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

        {/* Mobile Navigation Menu - same page list as desktop. Closes on
            click directly (not just via the pathname-change effect above) -
            a link to the page already open would otherwise never see a
            pathname change to close on. */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t-2 border-ink bg-bhoomi-spruce px-4 pt-3 pb-5 space-y-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                {item.labelKey ? t(item.labelKey) : item.label}
              </NavLink>
            ))}
            {isGuest && (
              <Link to="/register" className={mobileNavLinkClass({ isActive: false })} onClick={() => setMobileMenuOpen(false)}>
                {t('nav.getStarted')}
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              isGuest || isCitizen ? <HomePage /> : <Navigate to={portalPathForRole(authUser!.role)} replace />
            }
          />
          <Route
            path="/citizen/*"
            element={
              <RequireAuth roles={['CITIZEN']}>
                <CitizenPortal />
              </RequireAuth>
            }
          />
          <Route
            path="/officer/*"
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
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <AdminPortal />
                </div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route
            path="/parcels/:id"
            element={
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <Parcel360View />
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
