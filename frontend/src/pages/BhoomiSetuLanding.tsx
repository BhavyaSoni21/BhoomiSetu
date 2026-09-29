import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  FileText,
  FileCheck2,
  Receipt,
  ShieldAlert,
  Scale,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  Layers,
  Sparkles,
  Calendar,
  Check,
  TrendingUp,
  Crop,
  ShieldCheck,
  Globe,
  Users,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  History,
  UserCheck,
  Share2,
  ExternalLink,
  Code2,
  Cpu,
  Database,
  Wrench,
  Smartphone,
  CheckCircle2,
  Landmark,
  FileSpreadsheet,
  TreePine,
  Car,
  Banknote,
  QrCode,
  Download,
  Award,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import ParcelSearchModal from '../components/landing/ParcelSearchModal';
import { SchemesMarquee } from '../components/landing/SchemesMarquee';
import { GOVT_SCHEMES } from '../data/govtSchemes';
import { useTheme } from '../theme/theme';
import { useAuthUser } from '../features/auth/auth';
import apiService from '../services/apiService';

export const BhoomiSetuLanding: React.FC = () => {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const { t, currentLang, setLanguage } = useTranslation();
  const { data: authUser } = useAuthUser();
  const isGuest = !authUser;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0);
  const [activeNavDropdown, setActiveNavDropdown] = useState<string | null>(null);
  const [tickerPlaying, setTickerPlaying] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Public metrics are optional. Keep the page honest when the API is
  // unavailable instead of showing a second, conflicting parcel count.
  const [stats, setStats] = useState<{ parcels: number; serviceRequests: number } | null>(null);
  useEffect(() => {
    apiService.get('/public/stats').then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  // Ticker rotation
  const tickerItems = [
    t('landing.ticker.items.0'),
    t('landing.ticker.items.1'),
    t('landing.ticker.items.2'),
    t('landing.ticker.items.3'),
  ];

  useEffect(() => {
    if (!tickerPlaying) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerItems.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [tickerPlaying, tickerItems.length]);

  const handleFontSizeChange = (delta: number) => {
    setFontSizeOffset((prev) => {
      const next = Math.max(-2, Math.min(3, prev + delta));
      document.documentElement.style.fontSize = next === 0 ? '' : `${100 + next * 6.25}%`;
      return next;
    });
  };

  const resetFontSize = () => {
    setFontSizeOffset(0);
    document.documentElement.style.fontSize = '';
  };



  // How it works steps
  const workflowSteps = [
    { num: '01', title: t('landing.workflowSteps.step1.title'), desc: t('landing.workflowSteps.step1.desc') },
    { num: '02', title: t('landing.workflowSteps.step2.title'), desc: t('landing.workflowSteps.step2.desc') },
    { num: '03', title: t('landing.workflowSteps.step3.title'), desc: t('landing.workflowSteps.step3.desc') },
    { num: '04', title: t('landing.workflowSteps.step4.title'), desc: t('landing.workflowSteps.step4.desc') },
    { num: '05', title: t('landing.workflowSteps.step5.title'), desc: t('landing.workflowSteps.step5.desc') },
  ];

  // Who is this for
  // (Removed the multi-role stakeholder list — this page is citizen-centric.)

  // Core platform capabilities — citizen-facing only (this is a public,
  // citizen-centric page; officer/admin tooling lives behind their portals).
  const impactSectors = [
    { name: t('landing.impactSectors.parcel360View.title'), desc: t('landing.impactSectors.parcel360View.desc'), icon: Layers },
    { name: t('landing.impactSectors.gisParcelSearch.title'), desc: t('landing.impactSectors.gisParcelSearch.desc'), icon: MapPin },
    { name: t('landing.impactSectors.documentVerification.title'), desc: t('landing.impactSectors.documentVerification.desc'), icon: FileCheck2 },
    { name: t('landing.impactSectors.citizenServiceRequests.title'), desc: t('landing.impactSectors.citizenServiceRequests.desc'), icon: UserCheck },
    { name: t('landing.impactSectors.historicalImageryComparison.title'), desc: t('landing.impactSectors.historicalImageryComparison.desc'), icon: History },
    { name: t('landing.impactSectors.aiAssistance.title'), desc: t('landing.impactSectors.aiAssistance.desc'), icon: Sparkles },
  ];



// Hero badges data - keep structure, translate text via t()
  const heroBadges = [
    { text: t('landing.hero.badges.0.text'), icon: ShieldCheck },
    { text: t('landing.hero.badges.1.text'), icon: Layers },
    { text: t('landing.hero.badges.2.text'), icon: Globe },
    { text: t('landing.hero.badges.3.text'), icon: Users },
  ];

  // Feature cards data - keep structure, translate text via t()
  const featureCards = [
    { id: 'search', title: t('landing.featureCards.search.title'), desc: t('landing.featureCards.search.desc'), icon: MapPin, action: 'search' },
    { id: 'ocr', title: t('landing.featureCards.ocr.title'), desc: t('landing.featureCards.ocr.desc'), icon: FileCheck2, action: 'verify' },
    { id: 'requests', title: t('landing.featureCards.requests.title'), desc: t('landing.featureCards.requests.desc'), icon: UserCheck, action: 'citizen' },
  ];

  const handleCardClick = (action: string) => {
    if (action === 'search' || action === 'verify') {
      setIsSearchModalOpen(true);
    } else if (action === 'citizen') {
      navigate('/citizen');
    } else {
      setIsSearchModalOpen(true);
    }
  };

  return (
    <div
      className="min-h-screen font-sans antialiased selection:bg-[var(--action-500)] selection:text-white"
      style={{
        background: 'var(--hero-bg)',
        backgroundColor: 'var(--page-bg)',
        color: 'var(--text-primary)',
      }}
    >
      <main id="main-content" className="w-full">
        {/* ========================================================================= */}
        {/* 04. HERO SECTION WITH CONNECTED NODE VISUAL                               */}
        {/* ========================================================================= */}
        <section className="relative w-full overflow-hidden bg-[var(--page-bg)]">
          {/* Background image spans the complete viewport-width section. */}
          <div className="absolute inset-0 h-full w-full pointer-events-none">
              <picture>
                {/* Mobile gets a dedicated composition; desktop keeps the wide team shot */}
                <source media="(max-width: 640px)" type="image/webp" srcSet="/mobile-landing.webp" />
                <source media="(max-width: 640px)" srcSet="/mobile-landing.png" />
                <source type="image/webp" srcSet="/hero-team.webp" />
                <img
                  src="/hero-team.jpg"
                  alt="Hero Background"
                  width={1679}
                  height={937}
                  decoding="async"
                  className="w-full h-full object-cover object-center sm:object-right"
                />
              </picture>
            </div>

            {/* Gradient overlay: top-down fade on mobile (portrait hero), side fade on desktop */}
            <div className="absolute inset-0 sm:hidden" style={{ background: 'linear-gradient(180deg, var(--page-bg) 8%, color-mix(in srgb, var(--page-bg) 70%, transparent) 42%, transparent 70%)' }} />
            <div className="absolute inset-0 hidden sm:block" style={{ background: 'linear-gradient(90deg, var(--page-bg) 30%, color-mix(in srgb, var(--page-bg) 80%, transparent) 50%, transparent 65%)' }} />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24">
              <div className="max-w-2xl space-y-6">
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-[var(--text-heading)] leading-[1.15] drop-shadow-sm">
                    {t('landing.hero.headlineLine1')}
                    <br />
                    {t('landing.hero.headlineLine2')}
                  </h1>
                  <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-bold text-[var(--action-700)] tracking-tight mt-1.5 drop-shadow-sm">
                    {t('landing.hero.brandSolution')}
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed max-w-xl font-medium drop-shadow-sm">
                  {t('landing.hero.body')}
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="px-5 py-2.5 bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white font-medium text-sm rounded-[4px] transition-colors duration-150 flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <span>{t('landing.hero.exploreNow')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link
                    to="/features"
                    className="px-5 py-2.5 bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-[var(--text-heading)] font-medium text-sm rounded-[4px] border border-[var(--border)] transition-colors duration-150 flex items-center gap-2 shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>{t('landing.hero.learnMore')}</span>
                  </Link>
                </div>

                <div className="pt-6 border-t border-[var(--border)]/60 flex flex-wrap gap-2.5 text-xs text-[var(--text-primary)] font-bold">
                  {heroBadges.map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.text} className="flex items-center gap-1.5 py-1.5 px-2.5 bg-[var(--surface-1)] sm:bg-[var(--surface-1)]/80 backdrop-blur-sm rounded-[4px] border border-[var(--border)] sm:border-[var(--border)]/80 shadow-sm">
                        <Icon className="w-3.5 h-3.5 text-[var(--bhashini-accent)] shrink-0" />
                        <span className="text-[11px] leading-tight">{b.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
        </section>

        {/* ========================================================================= */}
        {/* 04B. GOVERNMENT SCHEMES MARQUEE (AUTO-SCROLLING TICKER)                  */}
        {/* ========================================================================= */}
        <SchemesMarquee schemes={GOVT_SCHEMES} />

        {/* ========================================================================= */}
        {/* 05. FEATURE CARDS GRID & LIVE GIS PREVIEW                                 */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)]/60 border-y border-[var(--border)] py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 4 Feature Cards in lighter warm amber/cream tone */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {featureCards.slice(0, 4).map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.id}
                      onClick={() => handleCardClick(card.action)}
                      className="bg-[var(--surface-2)] hover:bg-[var(--action-500)]/15 text-[var(--text-primary)] p-4 rounded-2xl border border-[var(--action-500)]/30 hover:border-[var(--action-500)] shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[var(--action-500)]/20 flex items-center justify-center group-hover:bg-[var(--action-500)]/30 transition">
                            <Icon className="w-4 h-4 text-[var(--action-700)]" />
                          </div>
                          <h3 className="font-semibold text-xs sm:text-[13px] text-[var(--text-primary)]">{card.title}</h3>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-normal">{card.desc}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[var(--action-700)] group-hover:gap-2 transition-all">
                        <span>{t('landing.featureCards.exploreCta')}</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Live GIS Preview */}
              <div className="lg:col-span-5">
                <div className="bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--bhashini-accent)] animate-pulse" />
                      <span className="font-bold text-xs text-[var(--text-heading)] tracking-tight">{t('landing.liveGisPreview.title')}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">{t('landing.liveGisPreview.location')}</span>
                  </div>
                  <div className="h-56 bg-[var(--surface-2)] relative">
                    <picture>
                      <source type="image/webp" srcSet="/Parcel-example.webp" />
                      <img
                        src="/Parcel-example.png"
                        alt={t('landing.liveGisPreview.altText', 'Cadastral parcel map preview showing land boundaries and boundaries')}
                        width={722}
                        height={443}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </picture>
                  </div>
                  <div className="px-4 py-2 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-mono">
                      <MapPin className="w-3 h-3 text-[var(--action-700)]" />
                      <span>{stats ? t('landing.liveGisPreview.parcelsCount', { count: stats.parcels }) : t('landing.liveGisPreview.seededDataLabel', 'Seeded demo parcel data')}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[10px] border border-amber-300">{t('landing.liveGisPreview.demoDataBadge', 'Prototype data')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 06. THE PROBLEM WE SOLVE SECTION                                           */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)] py-12 sm:py-16 border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-500)]">
                  {t('landing.problem.eyebrow')}
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-heading)] leading-tight">
                  {t('landing.problem.headingPart1')} <span className="text-[var(--action-500)]">{t('landing.problem.headingHighlight')}</span>
                  <br />{t('landing.problem.headingPart2')}
                </h2>
                <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-lg">
                  {t('landing.problem.paragraph1')}
                </p>
                <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-lg">
                  {t('landing.problem.paragraph2Prefix')}<strong className="text-[var(--text-heading)]">{t('landing.problem.paragraph2Bold')}</strong>{t('landing.problem.paragraph2Suffix')}
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white font-medium text-sm transition shadow-xs flex items-center gap-2"
                  >
                    <span>{t('landing.problem.searchCta')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link
                    to="/about"
                    className="px-5 py-2.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-heading)] font-medium text-sm transition"
                  >
                    {t('landing.problem.learnMore')}
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6 flex justify-center items-center">
                <div className="relative w-full max-w-xl">
                  <picture>
                    <source type="image/webp" srcSet="/bhashini-dev-team.webp" />
                    <img
                      src="/bhashini-dev-team.png"
                      alt="BhoomiSetu team working on land governance platform"
                      width={1680}
                      height={933}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-auto object-contain drop-shadow-sm rounded-2xl"
                    />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 07. HOW IT WORKS â€” 5 STEPS                                                 */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)]/60 py-10 sm:py-12 border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--bhashini-accent)]">{t('landing.howItWorks.eyebrow')}</span>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-heading)] mt-1">{t('landing.howItWorks.heading')}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {workflowSteps.map((step) => (
                <div key={step.num} className="bg-[var(--surface-1)] p-4 rounded-2xl border border-[var(--border)] shadow-xs relative">
                  <span className="text-xs font-mono font-bold text-[var(--action-500)] block mb-1">{t('landing.howItWorks.stepPrefix')} {step.num}</span>
                  <h4 className="font-bold text-sm text-[var(--text-heading)] mb-1">{step.title}</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-normal">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 08. ARCHITECTURE SECTION 3: MILESTONES AT A GLANCE (PHONE CENTERPIECE)     */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)] py-14 sm:py-20 border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-700)]">{t('landing.stats.eyebrow')}</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-heading)] mt-1">
                {t('landing.stats.heading')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--bhashini-accent)] font-mono block">{stats ? stats.parcels.toLocaleString() : '—'}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">{t('landing.stats.parcelsMapped.label')}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{t('landing.stats.parcelsMapped.desc')}</span>
              </div>
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--bhashini-accent)] font-mono block">7</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">{t('landing.stats.departmentFeeds.label')}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{t('landing.stats.departmentFeeds.desc')}</span>
              </div>
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--action-700)] font-mono block">3</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">{t('landing.stats.portals.label')}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{t('landing.stats.portals.desc')}</span>
              </div>
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--bhashini-accent)] font-mono block">100%</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">{t('landing.stats.deterministic.label')}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{t('landing.stats.deterministic.desc')}</span>
              </div>
            </div>

            <div className="text-center mt-10">
              <Link to="/citizen" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--bhashini-accent)] hover:underline">
                <span>{t('landing.stats.signInCta')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 10. PLATFORM CAPABILITIES GRID                                             */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)]/60 py-14 sm:py-20 border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-700)]">{t('landing.capabilities.eyebrow')}</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-heading)] mt-1">
                {t('landing.capabilities.heading')}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                {t('landing.capabilities.desc')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {impactSectors.map((sector) => {
                const Icon = sector.icon;
                return (
                  <div
                    key={sector.name}
                    className="bg-[var(--surface-1)] p-5 rounded-2xl border border-[var(--border)] shadow-xs hover:border-[var(--bhashini-accent)] hover:shadow-md transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[var(--bhashini-accent)] mb-3">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-[var(--text-heading)] mb-1.5">{sector.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{sector.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-8">
              <Link
                to="/features"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white text-xs font-semibold uppercase tracking-wider transition"
              >
                <span>{t('landing.capabilities.seeAll')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 11. BUILT FOR CITIZENS                                                    */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--surface-2)] border-b border-[var(--action-500)]/30 py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--action-700)]">{t('landing.roles.eyebrow')}</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)] mt-1 leading-tight">
                {t('landing.roles.heading')}
              </h2>
            </div>
            <div className="max-w-md mx-auto">
              <div className="bg-[var(--surface-1)] p-6 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[var(--bhashini-accent)] mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[var(--text-heading)] mb-2">{t('landing.roles.citizens.title')}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {t('landing.roles.citizens.desc')}
                </p>
                <Link to="/citizen" className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-[var(--bhashini-accent)] hover:underline">
                  <span>{t('landing.roles.citizens.cta')}</span><ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <div className="rounded-2xl overflow-hidden border border-[var(--action-500)]/30 shadow-md max-w-2xl w-full">
                <picture>
                  <source type="image/webp" srcSet="/community-land.webp" />
                  <img
                    src="/community-land.jpg"
                    alt="Citizens and officers working with BhoomiSetu land governance platform"
                    width={1672}
                    height={644}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-cover max-h-[240px]"
                  />
                </picture>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 12. ALIGNMENT WITH GOVERNMENT INITIATIVES                                  */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)] py-12 sm:py-16 border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--bhashini-accent)]">
                  {t('landing.govAlignment.eyebrow')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)] leading-tight">
                  {t('landing.govAlignment.heading')}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xl">
                  {t('landing.govAlignment.desc')}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {/* Scheme/program names - proper nouns, deliberately not translated (same convention as the SVAMITVA badge elsewhere) */}
                  {['SVAMITVA Scheme', 'ULPIN / Bhu-Aadhaar', 'Digital India', 'MeitY', 'NIC', 'DILRMP'].map((label) => (
                    <span key={label} className="px-3 py-1.5 rounded-[4px] bg-[var(--surface-1)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)]">{label}</span>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 bg-[var(--surface-2)] p-5 rounded-[8px] border border-[var(--border)]">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-3">
                  {t('landing.govAlignment.connectsLabel')}
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  {/* The 8 government departments BhoomiSetu integrates (matches the seeded Department directory) */}
                  {['Land Records', 'Registration', 'Planning', 'Tax', 'Restriction', 'Dispute', 'Encumbrance', 'Survey'].map((label) => (
                    <div key={label} className="p-2.5 bg-[var(--surface-1)] rounded border border-[var(--border)] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--bhashini-accent)] shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 13. CLOSING CALL TO ACTION BANNER                                         */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--surface-2)] text-[var(--text-heading)] border-t border-[var(--border)] py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-heading)] tracking-tight">
              {t('landing.cta.heading')}
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto font-medium">
              {t('landing.cta.desc')}
            </p>
            <div className="pt-2">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white font-bold text-sm tracking-wide transition shadow-md"
              >
                <span>{t('landing.cta.button')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 14. LATEST UPDATES TICKER (BOTTOM BANNER)                                 */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--brand-900)] text-white border-t border-white/10 py-2.5 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 rounded-[3px] bg-[var(--bhashini-accent)] text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('landing.tickerLabel')}
              </span>
            </div>

            <div className="flex-1 overflow-hidden">
              <p className="text-xs sm:text-sm text-white/70 truncate font-medium">
                {tickerItems[tickerIndex]}
              </p>
            </div>

            <div className="flex items-center gap-1 text-white/50 shrink-0">
              <button
                type="button"
                onClick={() => setTickerIndex((prev) => (prev - 1 + tickerItems.length) % tickerItems.length)}
                className="p-1 hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTickerPlaying(!tickerPlaying)}
                className="p-1 hover:text-white transition"
              >
                {tickerPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setTickerIndex((prev) => (prev + 1) % tickerItems.length)}
                className="p-1 hover:text-white transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Parcel Search Modal */}
      <ParcelSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
};

export default BhoomiSetuLanding;
