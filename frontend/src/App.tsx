import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowLeft, ArrowRight, Moon, Sun, Phone, ShieldCheck, Bell, UserCircle2 } from 'lucide-react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import RequireAuth from './features/auth/RequireAuth';
import { useAuthUser, useLogout } from './features/auth/auth';
import { OFFICER_ROLES, ROLE_LABELS } from './features/officer/officerAuth';
import AskAiWidget from './features/ai/AskAiWidget';
import { SUPPORTED_LANGUAGES, SupportedLanguage, setStoredLanguage } from './i18n/config';
import { useTheme } from './theme/theme';
import { NavItem, CITIZEN_NAV_ITEMS, OFFICER_NAV_ITEMS, ADMIN_NAV_ITEMS } from './navConfig';

// KNOWN_RISKS.md HIGH-8: these four are the bulk of the app's 1.98 MB single
// bundle - every portal's dashboards/map-layer tools plus Parcel360's
// MapLibre GL usage, all previously shipped to every visitor regardless of
// which route (or role) they actually land on. React.lazy + the <Suspense>
// boundary around <Routes> below is the only change this needs - the route
// structure itself is untouched.
const CitizenPortal = lazy(() => import('./pages/CitizenPortal'));
const OfficerPortal = lazy(() => import('./pages/OfficerPortal'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const Parcel360View = lazy(() => import('./features/parcels/Parcel360View'));

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
      <svg className="w-8 h-8 animate-spin text-brand-900" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

const BsIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="7" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.22" />
    <rect x="8.5" y="3" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
  </svg>
);

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 rounded-xl whitespace-nowrap ${
    isActive
      ? 'border-b-2 border-[var(--bhashini-accent)] text-[var(--bhashini-accent)] bg-emerald-50/80 dark:bg-emerald-900/20 font-bold'
      : 'text-[var(--text-primary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2.5 text-sm font-semibold uppercase tracking-wider rounded-xl ${
    isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-[var(--bhashini-accent)] font-bold' : 'text-[var(--text-primary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]'
  }`;

function navItemsFor(role: string | undefined): NavItem[] {
  const home: NavItem = { to: '/', end: true, labelKey: 'nav.home' };
  const about: NavItem = { to: '/about', labelKey: 'nav.about' };
  if (!role) return [home, about, { to: '/features', labelKey: 'nav.features' }];
  if (role === 'CITIZEN') return [home, about, ...CITIZEN_NAV_ITEMS];
  if (role === 'ADMIN') return ADMIN_NAV_ITEMS;
  return OFFICER_NAV_ITEMS;
}

function portalPathForRole(role: string): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'CITIZEN') return '/citizen';
  return '/officer';
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
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
    <div className="min-h-screen text-text-primary flex flex-col font-sans" style={{ background: 'var(--page-bg-gradient)', backgroundColor: 'var(--page-bg)' }}>
      {/* ── GIGW 3.0 Skip Link ── */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ── Minimal Brand Strip for Auth Pages ── */}
      {isAuthPage && (
        <header className="utility-bar border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-end gap-4">
            {/* Login/RegisterPage's own top bar already has a real, working
                language toggle (features/officer/../pages/LoginPage.tsx's
                handleLanguageChange, i18n.changeLanguage-backed) - this strip
                previously duplicated it with a second, redundant one. */}
            <Link to="/" className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white font-semibold">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t('nav.returnToPortal')}
            </Link>
          </div>
        </header>
      )}

      {/* ── Official Government Utility Bar (Internal Pages) ── */}
      {!isAuthPage && (
        <>
          <div className="utility-bar text-white/85 text-xs py-1.5 px-4 sm:px-6 lg:px-8 border-b border-white/10">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
              {/* Left: Indian National Flag & Government Header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col w-4 h-3 overflow-hidden rounded-xs border border-white/30">
                    <div className="h-1 bg-[#ff9933]"></div>
                    <div className="h-1 bg-white"></div>
                    <div className="h-1 bg-[#138808]"></div>
                  </div>
                  <span className="font-heading font-bold text-white tracking-wide text-[11px] uppercase">
                    Government of India · State Land Records
                  </span>
                </div>
                <span className="hidden md:inline text-white/30">•</span>
                <span className="hidden md:inline text-white/70 text-[11px] font-mono">
                  SVAMITVA Scheme Integrated
                </span>
              </div>

              {/* Right: Citizen Helpline, Language, Theme, User badge */}
              <div className="flex items-center gap-4 text-[11px] sm:text-xs">
                <span className="hidden sm:flex items-center gap-1.5 text-white/90">
                  <Phone className="w-3.5 h-3.5 text-action-500" aria-hidden="true" />
                  <span>Toll-Free Helpline: <strong>1800-11-2026</strong></span>
                </span>

                <span className="text-white/20 hidden sm:inline">|</span>

                {/* Language Selector */}
                <select
                  aria-label="Language selection"
                  value={i18n.language}
                  onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                  className="bg-transparent text-white/90 hover:text-white cursor-pointer focus:outline-none text-[11px] font-semibold"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang} className="bg-[var(--brand-900)] text-white">
                      {lang === 'Hindi' ? 'हिंदी (Hindi)' : lang}
                    </option>
                  ))}
                </select>

                <span className="text-white/20">|</span>

                {/* Dark mode toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="text-white/80 hover:text-action-500 transition"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>

                <span className="text-white/20">|</span>

                {authUser ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-white/80 hidden sm:inline">
                      {authUser.name} ({authUser.role})
                    </span>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-action-500 hover:text-action-400 font-bold transition ml-1"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="text-white/90 hover:text-action-500 font-bold transition">
                      Sign in
                    </Link>
                    <span className="text-white/30">/</span>
                    <Link to="/register" className="text-white/90 hover:text-action-500 font-bold transition">
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Ministry & Brand Header ── */}
          <div className="ministry-header">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
              {/* Left: Ashoka Lion Capital + Ministry */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 60 75"
                    className="w-8 h-10 sm:w-9 sm:h-12 text-[var(--text-heading)] shrink-0"
                    fill="currentColor"
                    aria-label="State Emblem of India"
                  >
                    <path d="M30 4C24 4 20 8 18 13C16 11 13 12 12 15C10 20 13 25 15 28C14 30 14 33 16 36C18 40 23 42 27 43L27 49C24 49 20 50 17 53C14 56 14 60 14 62L46 62C46 60 46 56 43 53C40 50 36 49 33 49L33 43C37 42 42 40 44 36C46 33 46 30 45 28C47 25 50 20 48 15C47 12 44 11 42 13C40 8 36 4 30 4ZM26 14C27 12 28 11 30 11C32 11 33 12 34 14C35 16 35 18 34 20C33 22 32 23 30 23C28 23 27 22 26 20C25 18 25 16 26 14ZM30 65C23 65 17 66 12 68L12 71L48 71L48 68C43 66 37 65 30 65Z" />
                    <circle cx="30" cy="56" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M22 74L38 74" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div className="border-l border-[var(--border)] pl-2 sm:pl-2.5">
                    <span className="block text-[10px] font-bold text-[var(--text-heading)] leading-tight">
                      पंचायती राज मंत्रालय
                    </span>
                    <span className="block text-[9px] font-semibold text-[var(--text-secondary)] tracking-tight leading-tight uppercase mt-0.5">
                      MINISTRY OF PANCHAYATI RAJ
                    </span>
                  </div>
                </div>

                <div className="hidden md:block h-7 w-[1px] bg-[var(--border)] mx-1"></div>

                <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)] tracking-wide">
                  <span>MODERNIZING LAND ADMINISTRATION. EMPOWERING CITIZENS.</span>
                </div>
              </div>

              {/* Right: BhoomiSetu Logo */}
              <Link to="/" className="flex items-center gap-2 group">
                <img
                  src="/logo-header.png"
                  alt="BhoomiSetu"
                  className="h-9 sm:h-10 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="flex flex-col">
                  <span className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-heading)] leading-none">
                    Bhoomi<span className="text-[var(--bhashini-accent)]">Setu</span>
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] font-medium tracking-tight mt-0.5">
                    Land Governance Portal
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* ── Primary Government Navigation Bar ── */}
          <header className="navbar sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-12 sm:h-13">
                {/* Desktop Navigation Links */}
                <nav className="hidden lg:flex items-center flex-1 min-w-0">
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {navItems.filter((item) => !item.iconOnly).map((item) => (
                      <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                        {item.labelKey ? t(item.labelKey) : item.label}
                      </NavLink>
                    ))}
                  </div>

                  {/* Icon-only items pinned to right */}
                  {navItems.some((i) => i.iconOnly) && (
                    <div className="flex items-center gap-1 ml-auto pl-3 border-l border-[var(--border)] shrink-0">
                      {navItems.filter((item) => item.iconOnly).map((item) => {
                        const Icon = item.iconName === 'Bell' ? Bell : UserCircle2;
                        const ariaLabel = item.labelKey ? t(item.labelKey) : item.label ?? item.to;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            title={ariaLabel}
                            aria-label={ariaLabel}
                            className={({ isActive }) =>
                              `shrink-0 w-8 h-8 flex items-center justify-center rounded-[4px] transition-all duration-150 ${
                                isActive
                                  ? 'bg-emerald-100 dark:bg-emerald-900/20 text-[var(--bhashini-accent)] shadow-xs'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]'
                              }`
                            }
                          >
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </nav>

                {/* Right CTA */}
                <div className="flex items-center gap-3 ml-auto">
                  {isGuest && (
                    <Link
                      to="/register"
                      className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-xs font-semibold text-white transition bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] shadow-xs"
                    >
                      <span>Get Started</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen((open) => !open)}
                    className="lg:hidden p-2 rounded text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                    aria-controls="mobile-menu"
                    aria-expanded={mobileMenuOpen}
                    aria-label="Toggle navigation menu"
                  >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {mobileMenuOpen && (
              <div id="mobile-menu" className="mobile-menu lg:hidden border-t border-[var(--border)] px-4 py-3 space-y-1 shadow-lg">
                {navItems.map((item) => {
                  const label = item.labelKey ? t(item.labelKey) : item.label ?? item.to;
                  const Icon = item.iconName === 'Bell' ? Bell : item.iconName === 'UserCircle2' ? UserCircle2 : null;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={mobileNavLinkClass}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        {label}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </header>
        </>
      )}

      {/* ── Main Content Area with GIGW ID ── */}
      <main id="main-content" className="flex-1 min-h-0">
        <Suspense fallback={<RouteLoadingFallback />}>
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
              path="/admin/*"
              element={
                <RequireAuth roles={['ADMIN']}>
                  <AdminPortal />
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
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                  <Parcel360View />
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>

      {/* NO FOOTER ON ANY PAGE ("we dont need footer") */}

      {/* Floating Ask AI Widget */}
      {!location.pathname.startsWith('/officer') &&
        !location.pathname.startsWith('/admin') &&
        !isAuthPage && (
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
