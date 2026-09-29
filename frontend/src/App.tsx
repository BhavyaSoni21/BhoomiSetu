import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation, SupportedLanguage } from './context/LanguageContext';
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowLeft, ArrowRight, Moon, Sun, Phone, ShieldCheck, Bell, UserCircle2, ChevronDown, Users, Building2, Lock, HelpCircle } from 'lucide-react';
import Footer from './components/Footer';
import OfflineStatusIndicator from './components/OfflineStatusIndicator';

// Route-level code splitting - each page (and everything it only itself
// imports, e.g. maplibre-gl via Parcel360View/CitizenPortal's map views) now
// ships in its own chunk instead of every page's code loading on every route.
const Parcel360View = lazy(() => import('./features/parcels/Parcel360View'));
const HomePage = lazy(() => import('./pages/HomePage'));
const CitizenPortal = lazy(() => import('./pages/CitizenPortal'));
const OfficerPortal = lazy(() => import('./pages/OfficerPortal'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const VerifierPortal = lazy(() => import('./pages/VerifierPortal'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfUsePage = lazy(() => import('./pages/TermsOfUsePage'));
const ContactUsPage = lazy(() => import('./pages/ContactUsPage'));
const AskAiWidget = lazy(() => import('./features/ai/AskAiWidget'));
const OnboardingGate = lazy(() => import('./features/onboarding/OnboardingGate'));
import RequireAuth from './features/auth/RequireAuth';
import { useAuthUser, useLogout } from './features/auth/auth';
import { OFFICER_ROLES, ROLE_LABELS, ROLE_DEPARTMENT } from './features/officer/officerAuth';
import { useTheme } from './theme/theme';
import { NavItem, CITIZEN_NAV_ITEMS, ADMIN_NAV_ITEMS, VERIFIER_NAV_ITEMS, getOfficerNavItems, OFFICER_NAV_ITEMS } from './navConfig';
import SvgIndianEmblem from './components/IndianEmblem';

const BsIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="7" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.22" />
    <rect x="8.5" y="3" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
  </svg>
);

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 rounded-xl whitespace-nowrap ${isActive
    ? 'border-b-2 border-[var(--bhashini-accent)] text-[var(--bhashini-accent)] bg-emerald-50/80 dark:bg-emerald-900/20 font-bold'
    : 'text-[var(--text-primary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-4 py-2.5 text-sm font-semibold uppercase tracking-wider rounded-xl ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-[var(--bhashini-accent)] font-bold' : 'text-[var(--text-primary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]'
  }`;

// Desktop-only Tools/Analytics dropdown. Children are only real <a> links while
// open; a child's route is still reachable by URL regardless (backend enforces).
function DesktopNavGroup({
  item,
  t,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  t: (key: string) => string;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const label = item.labelKey ? t(item.labelKey) : item.label ?? '';
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={open}
        className={`shrink-0 inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 rounded-xl whitespace-nowrap ${open
          ? 'text-[var(--bhashini-accent)] bg-emerald-50/80 dark:bg-emerald-900/20 font-bold'
          : 'text-[var(--text-primary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]'
        }`}
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[200px] py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg z-50">
          {item.children!.map((child) => (
            <NavLink
              key={child.to}
              to={child.to!}
              end={child.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `block px-4 py-2 text-xs font-semibold whitespace-nowrap ${isActive
                  ? 'text-[var(--bhashini-accent)] bg-emerald-50/80 dark:bg-emerald-900/20'
                  : 'text-[var(--text-primary)] hover:text-[var(--bhashini-accent)] hover:bg-[var(--surface-2)]'
                }`
              }
            >
              {child.labelKey ? t(child.labelKey) : child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function navItemsFor(role: string | undefined, department?: string): NavItem[] {
  const home: NavItem = { to: '/', end: true, labelKey: 'nav.home' };
  const about: NavItem = { to: '/about', labelKey: 'nav.about' };
  if (!role) return [home, about, { to: '/features', labelKey: 'nav.features' }];
  if (role === 'CITIZEN') return [home, about, ...CITIZEN_NAV_ITEMS];
  if (role === 'ADMIN') return ADMIN_NAV_ITEMS;
  if (role === 'VERIFIER') return VERIFIER_NAV_ITEMS;
  if (department) return getOfficerNavItems(department);
  return OFFICER_NAV_ITEMS;
}

function portalPathForRole(role: string): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'CITIZEN') return '/citizen';
  if (role === 'VERIFIER') return '/verifier';
  return '/officer';
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, currentLang, setLanguage } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const [theme, toggleTheme] = useTheme();
  const { data: authUser } = useAuthUser();
  const logout = useLogout();
  const isGuest = !authUser;
  const isCitizen = authUser?.role === 'CITIZEN';
  const department = authUser?.role && ROLE_DEPARTMENT[authUser?.role as keyof typeof ROLE_DEPARTMENT];
  const navItems = navItemsFor(authUser?.role, department);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenMenu(null);
    window.scrollTo(0, 0); // every new tab/route starts at the top, not mid-scroll
  }, [location.pathname]);

  // Close an open Tools/Analytics dropdown on outside click.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);


  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      navigate('/login', { replace: true });
    };
    window.addEventListener('bhoomisetu:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('bhoomisetu:unauthorized', handleUnauthorized);
  }, [logout, navigate]);

  // The onboarding tour opens the mobile menu before spotlighting nav items so
  // its targets are rendered/visible on small screens (desktop nav is hidden).
  useEffect(() => {
    const open = () => setMobileMenuOpen(true);
    window.addEventListener('bhoomisetu:open-mobile-menu', open);
    return () => window.removeEventListener('bhoomisetu:open-mobile-menu', open);
  }, []);
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isLandingPage = location.pathname === '/';
  // The clean landing page now uses the same unified navbar as the rest of the
  // application to ensure complete consistency, per the user's explicit request.
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
            {/* flex-nowrap keeps this a single row on mobile; the gov label
                truncates rather than wrapping the whole bar into extra rows. */}
            <div className="max-w-7xl mx-auto flex flex-nowrap items-center justify-between gap-2 sm:gap-3">
              {/* Left: Indian National Flag & Government Header */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-heading font-bold text-white tracking-wide text-[11px] uppercase truncate">
                    <span className="sm:hidden">GoI · Land Records</span>
                    <span className="hidden sm:inline">Government of India · State Land Records</span>
                  </span>
                </div>
                <span className="hidden md:inline text-white/30">•</span>
                <span className="hidden md:inline text-white/70 text-[11px] font-mono">
                  SVAMITVA Scheme Integrated
                </span>
              </div>

              {/* Right: Citizen Helpline, Language, Theme, User badge */}
              <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs shrink-0">
                <span className="hidden sm:flex items-center gap-1.5 text-white/90">
                  <Phone className="w-3.5 h-3.5 text-action-500" aria-hidden="true" />
                  <span>Toll-Free Helpline: <strong>1800-11-2026</strong></span>
                </span>

                <span className="text-white/20 hidden sm:inline">|</span>

                <OfflineStatusIndicator />

                <span className="text-white/20 hidden sm:inline">|</span>

                {/* Language Selector */}
                <select
                  aria-label="Language selection"
                  value={currentLang}
                  onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                  className="bg-transparent text-white/90 hover:text-white cursor-pointer focus:outline-none text-[11px] font-semibold"
                >
                  <option value="en" className="bg-[var(--brand-900)] text-white">English</option>
                  <option value="hi" className="bg-[var(--brand-900)] text-white">हिंदी (Hindi)</option>
                  <option value="bn" className="bg-[var(--brand-900)] text-white">বাংলা (Bengali)</option>
                  <option value="gu" className="bg-[var(--brand-900)] text-white">ગુજરાતી (Gujarati)</option>
                  <option value="kn" className="bg-[var(--brand-900)] text-white">ಕನ್ನಡ (Kannada)</option>
                  <option value="ml" className="bg-[var(--brand-900)] text-white">മലയാളം (Malayalam)</option>
                  <option value="mr" className="bg-[var(--brand-900)] text-white">मराठी (Marathi)</option>
                  <option value="or" className="bg-[var(--brand-900)] text-white">ଓଡ଼ିଆ (Odia)</option>
                  <option value="pa" className="bg-[var(--brand-900)] text-white">ਪੰਜਾਬੀ (Punjabi)</option>
                  <option value="ta" className="bg-[var(--brand-900)] text-white">தமிழ் (Tamil)</option>
                  <option value="te" className="bg-[var(--brand-900)] text-white">తెలుగు (Telugu)</option>
                </select>

                <span className="text-white/20 hidden sm:inline">|</span>

                {/* Dark mode toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="text-white/80 hover:text-action-500 transition"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>

                {isCitizen && (
                  <>
                    <span className="text-white/20 hidden sm:inline">|</span>
                    {/* Replay the guided tour on demand (spec §13) - never
                        resets onboarding_completed; OnboardingGate listens. */}
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new Event('bhoomisetu:start-tour'))}
                      className="hidden sm:flex items-center gap-1 text-white/80 hover:text-action-500 font-semibold transition"
                    >
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('onboarding.takeATour', 'Take a tour')}
                    </button>
                  </>
                )}

                <span className="text-white/20 hidden sm:inline">|</span>

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
                      Sign Out
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
          <header className="ministry-header">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
              {/* Left: Ashoka Lion Capital + Ministry */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {/* CSS height overrides the intrinsic attrs: smaller row on mobile, full 70px on ≥sm. */}
                  <SvgIndianEmblem width="50" height="70" className="text-[var(--text-heading)] h-11 w-auto sm:h-[70px]" />
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
          </header>

          {/* ── Primary Government Navigation Bar ── */}
          <header className="navbar sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-12 sm:h-13">
                {/* Desktop Navigation Links */}
                <nav ref={navRef} className="hidden lg:flex items-center flex-1 min-w-0">
                  {/* No overflow-x here: an overflow container clips the
                      absolute Tools/Analytics dropdown (overflow-x:auto forces
                      overflow-y:auto), which showed a scrollbar instead of
                      letting the menu overlap the navbar and main body. At lg+
                      the bounded per-role item counts fit without scrolling. */}
                  <div className="flex items-center gap-1 py-1 min-w-0">
                    {navItems.filter((item) => !item.iconOnly).map((item) =>
                      item.children ? (
                        <DesktopNavGroup
                          key={item.labelKey ?? item.label}
                          item={item}
                          t={t}
                          open={openMenu === (item.labelKey ?? item.label)}
                          onToggle={() =>
                            setOpenMenu((cur) =>
                              cur === (item.labelKey ?? item.label) ? null : (item.labelKey ?? item.label!),
                            )
                          }
                          onNavigate={() => setOpenMenu(null)}
                        />
                      ) : (
                        <NavLink key={item.to} to={item.to!} end={item.end} data-tour={item.tourId} className={navLinkClass}>
                          {item.labelKey ? t(item.labelKey) : item.label}
                        </NavLink>
                      ),
                    )}

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
                            to={item.to!}
                            end={item.end}
                            title={ariaLabel}
                            aria-label={ariaLabel}
                            data-tour={item.tourId}
                            className={({ isActive }) =>
                              `shrink-0 w-8 h-8 flex items-center justify-center rounded-[4px] transition-all duration-150 ${isActive
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
                  // Tools / Analytics groups: header label + indented child links.
                  if (item.children) {
                    return (
                      <div key={item.labelKey ?? item.label} className="pt-1">
                        <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                          {label}
                        </div>
                        {item.children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to!}
                            end={child.end}
                            className={mobileNavLinkClass}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <span className="flex items-center gap-2 pl-4">
                              {child.labelKey ? t(child.labelKey) : child.label}
                            </span>
                          </NavLink>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to!}
                      end={item.end}
                      data-tour={item.tourId}
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
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading…</div>}>
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
          <Route
            path="/verifier/*"
            element={
              <RequireAuth roles={['VERIFIER']}>
                <VerifierPortal />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-use" element={<TermsOfUsePage />} />
          <Route path="/contact-us" element={<ContactUsPage />} />
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

      {/* ── Official Site Footer ── */}
      {!isAuthPage && <Footer />}

      {/* Floating Ask AI Widget */}
      {!location.pathname.startsWith('/officer') &&
        !location.pathname.startsWith('/admin') &&
        !isAuthPage && (
          <Suspense fallback={null}>
            <AskAiWidget />
          </Suspense>
        )}

      {/* First-login onboarding gate (citizen accounts only) - reads the
          backend onboarding flag, so it covers password login, registration
          and Google OAuth without touching each navigate-on-success site. */}
      <Suspense fallback={null}>
        <OnboardingGate />
      </Suspense>
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