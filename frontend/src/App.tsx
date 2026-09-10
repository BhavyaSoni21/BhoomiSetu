import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowLeft, ArrowRight, Moon, Sun, Phone, ShieldCheck, Bell, UserCircle2 } from 'lucide-react';
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
import { OFFICER_ROLES, ROLE_LABELS } from './features/officer/officerAuth';
import AskAiWidget from './features/ai/AskAiWidget';
import { SUPPORTED_LANGUAGES, SupportedLanguage, setStoredLanguage } from './i18n/config';
import { useTheme } from './theme/theme';
import { NavItem, CITIZEN_NAV_ITEMS, OFFICER_NAV_ITEMS, ADMIN_NAV_ITEMS } from './navConfig';

const BsIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="7" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.22" />
    <rect x="8.5" y="3" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
  </svg>
);

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-3 py-2 text-xs font-heading font-semibold uppercase tracking-wider transition-all duration-150 rounded-lg whitespace-nowrap ${
    isActive
      ? 'bg-white/15 text-white font-bold shadow-xs'
      : 'text-white/80 hover:text-white hover:bg-white/10'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2.5 text-sm font-heading font-bold uppercase tracking-wider rounded-lg ${
    isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
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
  const isLandingPage = location.pathname === '/';
  // The clean, chrome-free landing page is a guest-only presentation - a
  // signed-in citizen landing on "/" (it's not a redirect target for them,
  // see the route below) should see the exact same nav/footer/AI widget
  // they'd see anywhere else in their portal, per the user's explicit "the
  // navbar remains the same" and "there is no coming back" - hiding the
  // whole chrome on Home left a signed-in citizen with no way back to their
  // portal and no AI widget, not just a different-looking navbar.
  const hideChromeForLanding = isLandingPage && isGuest;

  return (
    <div className="min-h-screen bg-page-bg text-text-primary flex flex-col font-sans" style={{ background: 'var(--page-bg)' }}>
      {/* ── GIGW 3.0 Skip Link ── */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ── Minimal Brand Strip for Auth Pages ── */}
      {isAuthPage && (
        <header className="border-b border-white/10" style={{ background: 'var(--brand-900)' }}>
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
      {!isAuthPage && !hideChromeForLanding && (
        <>
          <div
            className="text-white/85 text-xs py-1.5 px-4 sm:px-6 lg:px-8 border-b border-white/10"
            style={{ background: '#092119' }}
          >
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
                    <option key={lang} value={lang} className="bg-[#0F3D2E] text-white">
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

          {/* ── Primary Government Navigation Bar ── */}
          <header
            className="border-b border-white/15 sticky top-0 z-40 backdrop-blur-md"
            style={{ background: 'var(--brand-900)' }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-14 sm:h-16">
                {/* Brand Logo & Title */}
                <Link to="/" className="flex items-center gap-2.5 mr-6 shrink-0 group">
                  <div className="text-white">
                    <BsIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-lg font-heading font-bold tracking-tight text-white block leading-none">
                      BhoomiSetu
                    </span>
                    <span className="text-[10px] font-mono text-white/60 tracking-wider uppercase block mt-0.5">
                      Land Governance Portal
                    </span>
                  </div>
                </Link>

                {/* Desktop Navigation Links — text links left, icon-only buttons pinned right */}
                <nav className="hidden lg:flex items-center flex-1 min-w-0">
                  {/* Text nav items */}
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {navItems.filter((item) => !item.iconOnly).map((item) => (
                      <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                        {item.labelKey ? t(item.labelKey) : item.label}
                      </NavLink>
                    ))}
                  </div>
                  {/* Icon-only items pinned to right */}
                  {navItems.some((i) => i.iconOnly) && (
                    <div className="flex items-center gap-1 ml-auto pl-3 border-l border-white/15 shrink-0">
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
                              `shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 ${
                                isActive
                                  ? 'bg-white/15 text-white shadow-xs'
                                  : 'text-white/75 hover:text-white hover:bg-white/10'
                              }`
                            }
                          >
                            <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
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
                      className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-heading font-bold text-white transition shadow-sm hover:shadow"
                      style={{ background: 'var(--action-600)' }}
                    >
                      <span>Get Started</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen((open) => !open)}
                    className="lg:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                    aria-controls="mobile-menu"
                    aria-expanded={mobileMenuOpen}
                    aria-label="Toggle navigation menu"
                  >
                    {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Navigation Menu */}
            {mobileMenuOpen && (
              <div id="mobile-menu" className="lg:hidden border-t border-white/15 px-4 py-3 space-y-1" style={{ background: '#092119' }}>
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
      </main>

      {/* ── Global Government Footer for Internal Pages ── */}
      {!hideChromeForLanding && !isAuthPage && (
        <footer className="mt-auto border-t border-gov-border py-6 px-4 sm:px-6 lg:px-8 text-xs text-text-secondary" style={{ background: 'var(--surface-2)' }}>
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-brand-900"><BsIcon className="w-5 h-5" /></span>
              <span className="font-heading font-bold text-text-heading">BhoomiSetu</span>
              <span>— Digital Land Governance Portal</span>
            </div>
            <p className="text-[11px] font-mono text-text-muted">
              GIGW 3.0 Compliant · SVAMITVA Integrated · Hosted by National Informatics Centre (NIC)
            </p>
          </div>
        </footer>
      )}

      {/* Floating Ask AI Widget */}
      {!location.pathname.startsWith('/officer') &&
        !location.pathname.startsWith('/admin') &&
        !isAuthPage &&
        !hideChromeForLanding && (
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
