import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  FileText,
  FileCheck2,
  Building2,
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
  AlertTriangle,
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
  Building,
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
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ParcelSearchModal from '../../components/landing/ParcelSearchModal';
import { useTheme } from '../../theme/theme';
import { setStoredLanguage } from '../../i18n/config';
import apiService from '../../services/apiService';
import MapComponent from '../../features/map/MapComponent';
import { ParcelSummary } from '../../types/parcel';
import { useAuthUser } from '../../features/auth/auth';

export const BhoomiSetuLanding: React.FC = () => {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const { i18n } = useTranslation();
  const { data: authUser } = useAuthUser();
  const isGuest = !authUser;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'HI'>(i18n.language === 'Hindi' ? 'HI' : 'EN');
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0);
  const [activeNavDropdown, setActiveNavDropdown] = useState<string | null>(null);
  const [tickerPlaying, setTickerPlaying] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const changeLanguage = (next: 'EN' | 'HI') => {
    setLanguage(next);
    const i18nLang = next === 'HI' ? 'Hindi' : 'English';
    i18n.changeLanguage(i18nLang);
    setStoredLanguage(i18nLang);
  };

  // Real Pune cluster data for the "Live GIS Preview" section
  const { data: puneParcelsData } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['landing-pune-cluster'],
    async () => (await apiService.get('/parcels', { params: { state: 'MH', district: 'PUN', limit: 500 } })).data,
  );
  const puneParcels = puneParcelsData?.parcels ?? [];

  // Ticker rotation
  const tickerItems = [
    'BhoomiSetu — India\'s parcel-centric land governance portal is live.',
    'SVAMITVA Scheme pilot: cadastral integration across 5 pilot states.',
    '220+ geo-verified parcels with complete Parcel 360° records.',
    'Connecting 7 department feeds: Land Records, Registration, Planning, Taxation, Restrictions, Disputes & Encumbrance.',
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
    { num: '01', title: 'Register or Sign In', desc: 'Citizens create a free account. Officers and admins use department credentials.' },
    { num: '02', title: 'Search Your Parcel', desc: 'Find any parcel by ULPIN, survey number, plot number, or local identifier.' },
    { num: '03', title: 'View Parcel 360°', desc: 'See ownership, registration, zoning, tax, disputes, and encumbrances in one place.' },
    { num: '04', title: 'Verify Documents', desc: 'Upload a land document and check it against official parcel records in seconds.' },
    { num: '05', title: 'Raise & Track Requests', desc: 'File service requests and track their status across every department, live.' },
  ];

  // Who is this for
  const stakeholders = [
    'Citizen Landowners',
    'Revenue Officers',
    'Registration Officers',
    'Planning Officers',
    'Tehsildars & Patwaris',
    'District Collectors',
    'State Administrators',
    'Dispute Adjudicators',
  ];

  // Core platform capabilities
  const impactSectors = [
    { name: 'Parcel 360° View', desc: 'One canonical record per parcel — ownership, registration, zoning, tax, restrictions, disputes & encumbrances unified in a single view.', icon: Layers },
    { name: 'GIS Parcel Search', desc: 'Find any parcel by ULPIN, survey number, plot number, or local identifier and explore it on a live satellite map.', icon: MapPin },
    { name: 'Document Verification', desc: 'Upload a land document photo and check it against official records — owner name, identifiers, and area — in seconds using AI-assisted OCR.', icon: FileCheck2 },
    { name: 'Citizen Service Requests', desc: 'Raise requests against your linked parcels, track their status across every department, and receive updates end-to-end.', icon: UserCheck },
    { name: 'Officer Workflow Dashboard', desc: 'Review citizen requests department-by-department with documents, pre-checks, and approve or reject with full audit trails.', icon: ShieldCheck },
    { name: 'Governance Alerts', desc: 'Automated alerts flag spatial changes detected via satellite imagery comparison — officers investigate and escalate as needed.', icon: AlertTriangle },
    { name: 'Historical Imagery Comparison', desc: 'Compare satellite imagery across years to detect unauthorized land use changes and trigger governance reviews.', icon: History },
    { name: 'Admin Oversight Tools', desc: 'Spatial layer authoring, officer workload monitoring, department management, and platform-wide analytics for administrators.', icon: Building },
    { name: 'AI Assistance (Groq)', desc: 'Plain-language explanations of records and alerts — AI assists only, all authoritative decisions stay deterministic and role-gated.', icon: Sparkles },
  ];



  // Text strings for bilingual support - ALL existing text preserved 100%
  const content = {
    EN: {
      utility: {
        skipToMain: 'Skip to main content',
        govOfIndia: 'Government of India',
        notifications: 'Notifications',
        accessibility: 'Accessibility',
      },
      ministry: {
        hindiName: 'पंचायती राज मंत्रालय',
        engName: 'MINISTRY OF PANCHAYATI RAJ',
        tagline1: 'MODERNIZING LAND ADMINISTRATION.',
        tagline2: 'EMPOWERING CITIZENS.',
      },
      nav: {
        home: 'Home',
        about: 'About',
        gisServices: 'GIS Services',
        verification: 'Verification',
        citizenServices: 'Citizen Services',
        resources: 'Resources',
        portalCta: 'BhoomiSetu Portal',
        loginRegister: 'Login/SignUp',
      },
      hero: {
        eyebrow: 'GIS-BASED LAND GOVERNANCE',
        headlineLine1: 'Every Detail About Your Land.',
        headlineLine2: 'In One Clear, Honest View.',
        brandSolution: 'Parcel-Centric. Department-Connected. AI-Assisted.',
        body: 'Land records in India are split across Survey, Registration, Planning, Taxation, and Revenue departments — each with its own records. BhoomiSetu makes the parcel itself the unifying identity, so citizens see one complete picture and officers can coordinate without switching portals.',
        exploreNow: 'Search a Parcel',
        learnMore: 'Learn More',
        searchCta: 'Search a Parcel',
        signInCta: 'Get Started',
        badges: [
          { text: 'Role-Gated & Audited', icon: ShieldCheck },
          { text: '7 Department Feeds', icon: Layers },
          { text: 'ULPIN / SVAMITVA Aligned', icon: Globe },
          { text: 'Citizen & Officer Portals', icon: Users },
        ],
      },
      featureCards: [
        { id: 'search', title: 'Parcel 360° Search', desc: 'Find any parcel by ULPIN, survey number, or plot number and see ownership, zoning, tax, disputes and encumbrances — all in one view.', icon: MapPin, action: 'search' },
        { id: 'ocr', title: 'Document Verification (OCR)', desc: 'Upload a photo of your land document and check it against official parcel records — owner name, area, and identifiers — in seconds.', icon: FileCheck2, action: 'verify' },
        { id: 'requests', title: 'Raise Service Requests', desc: 'File requests against your parcels — record copies, mutation, dispute — and track their status through every department.', icon: UserCheck, action: 'citizen' },
        { id: 'alerts', title: 'Governance Alerts', desc: 'Officers receive automated alerts on spatial changes and suspected encroachments flagged from satellite imagery comparison.', icon: AlertTriangle, action: 'alerts' },
      ],
      tickerLabel: 'LATEST UPDATES',
    },
    HI: {
      utility: {
        skipToMain: 'मुख्य सामग्री पर जाएं',
        govOfIndia: 'भारत सरकार',
        notifications: 'सूचनाएं',
        accessibility: 'सुगम्यता',
      },
      ministry: {
        hindiName: 'पंचायती राज मंत्रालय',
        engName: 'MINISTRY OF PANCHAYATI RAJ',
        tagline1: 'आधुनिक भू-प्रशासन।',
        tagline2: 'नागरिक सशक्तिकरण।',
      },
      nav: {
        home: 'मुख्य पृष्ठ',
        about: 'परिचय',
        gisServices: 'जीआईएस सेवाएं',
        verification: 'सत्यापन',
        citizenServices: 'नागरिक सेवाएं',
        resources: 'संसाधन',
        portalCta: 'भूमिसेतु पोर्टल',
        loginRegister: 'लॉगिन / पंजीकरण',
      },
      hero: {
        eyebrow: 'जीआईएस-आधारित भूमि शासन',
        headlineLine1: 'अपनी ज़मीन की पूरी जानकारी।',
        headlineLine2: 'एक स्पष्ट, सत्यापन योग्य दृश्य में।',
        brandSolution: 'भूखंड-केंद्रित। विभाग-जुड़ा। AI-सहायित।',
        body: 'भारत में भूमि अभिलेख सर्वेक्षण, पंजीकरण, योजना, कराधान और राजस्व विभागों में बिखरे हुए हैं। भूमिसेतु भूखंड को एकीकृत पहचान बनाता है — नागरिकों को पूरी जानकारी एक जगह मिलती है।',
        exploreNow: 'भूखंड खोजें',
        learnMore: 'अधिक जानें',
        searchCta: 'भूखंड खोजें',
        signInCta: 'शुरू करें',
        badges: [
          { text: 'भूमिका-आधारित एवं ऑडिटेड', icon: ShieldCheck },
          { text: '7 विभागीय डेटा फ़ीड', icon: Layers },
          { text: 'ULPIN / SVAMITVA अनुपालक', icon: Globe },
          { text: 'नागरिक एवं अधिकारी पोर्टल', icon: Users },
        ],
      },
      featureCards: [
        { id: 'search', title: 'भूखंड 360° खोज', desc: 'ULPIN, सर्वे नंबर या प्लॉट नंबर से भूखंड खोजें और स्वामित्व, ज़ोनिंग, कर, विवाद — सब एक जगह देखें।', icon: MapPin, action: 'search' },
        { id: 'ocr', title: 'दस्तावेज़ सत्यापन (OCR)', desc: 'अपने भूमि दस्तावेज़ की फ़ोटो अपलोड करें और आधिकारिक रिकॉर्ड से मिलान करें — मालिक का नाम, क्षेत्रफल, पहचानकर्ता।', icon: FileCheck2, action: 'verify' },
        { id: 'requests', title: 'सेवा अनुरोध दर्ज करें', desc: 'अपने भूखंड के लिए अनुरोध दर्ज करें — रिकॉर्ड की प्रति, उत्परिवर्तन, विवाद — और हर विभाग में स्थिति ट्रैक करें।', icon: UserCheck, action: 'citizen' },
        { id: 'alerts', title: 'शासन अलर्ट', desc: 'उपग्रह चित्रों की तुलना से पहचाने गए स्थानिक परिवर्तनों पर अधिकारियों को स्वचालित अलर्ट मिलते हैं।', icon: AlertTriangle, action: 'alerts' },
      ],
      tickerLabel: 'नवीनतम अपडेट',
    },
  };

  const t = content[language];

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
        <section className="w-full bg-[var(--page-bg)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Image - Bounded inside section container so it stays within section boundaries even when zoomed out */}
            <div className="absolute inset-0 w-full h-full pointer-events-none">
              <img 
                src="/hero-team.jpg" 
                alt="Hero Background" 
                className="w-full h-full object-cover object-right"
              />
            </div>

            {/* Gradient overlay: uses color-mix to properly apply opacity to the CSS variable */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, var(--page-bg) 30%, color-mix(in srgb, var(--page-bg) 80%, transparent) 50%, transparent 65%)' }} />

            <div className="pt-12 sm:pt-20 pb-16 sm:pb-24 relative z-10">
              <div className="max-w-2xl space-y-6">
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-tight text-[var(--text-heading)] leading-[1.15] drop-shadow-sm">
                    {t.hero.headlineLine1}
                    <br />
                    {t.hero.headlineLine2}
                  </h1>
                  <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-bold text-[var(--action-700)] tracking-tight mt-1.5 drop-shadow-sm">
                    {t.hero.brandSolution}
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed max-w-xl font-medium drop-shadow-sm">
                  {t.hero.body}
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="px-5 py-2.5 bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white font-medium text-sm rounded-[4px] transition-colors duration-150 flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <span>{t.hero.exploreNow}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link
                    to="/features"
                    className="px-5 py-2.5 bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-[var(--text-heading)] font-medium text-sm rounded-[4px] border border-[var(--border)] transition-colors duration-150 flex items-center gap-2 shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>{t.hero.learnMore}</span>
                  </Link>
                </div>

                <div className="pt-6 border-t border-[var(--border)]/60 flex flex-wrap gap-2.5 text-xs text-[var(--text-primary)] font-bold">
                  {t.hero.badges.map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.text} className="flex items-center gap-1.5 py-1.5 px-2.5 bg-[var(--surface-1)]/80 backdrop-blur-sm rounded-[4px] border border-[var(--border)]/80 shadow-sm">
                        <Icon className="w-3.5 h-3.5 text-[var(--bhashini-accent)] shrink-0" />
                        <span className="text-[11px] leading-tight">{b.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 05. FEATURE CARDS GRID & LIVE GIS PREVIEW                                 */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)]/60 border-y border-[var(--border)] py-8 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: 4 Feature Cards in lighter warm amber/cream tone */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {t.featureCards.slice(0, 4).map((card) => {
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
                        <span>Explore</span>
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
                      <span className="font-bold text-xs text-[var(--text-heading)] tracking-tight">Live GIS Preview</span>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">Pune · Maharashtra</span>
                  </div>
                  <div className="h-56 bg-[var(--surface-2)] relative">
                    <MapComponent parcels={puneParcels} fitToParcels showLayerPanel={false} />
                  </div>
                  <div className="px-4 py-2 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-mono">
                      <MapPin className="w-3 h-3 text-[var(--action-700)]" />
                      <span>{puneParcels.length} parcels · PostGIS</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[var(--bhashini-accent)] font-semibold text-[10px] border border-emerald-300">Live Data</span>
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
                  Why BhoomiSetu Exists
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-heading)] leading-tight">
                  Land Records Are <span className="text-[var(--action-500)]">Fragmented</span>
                  <br />Across 7+ Independent Systems
                </h2>
                <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-lg">
                  Survey, Registration, Planning, Taxation, Restrictions, Dispute, and Encumbrance departments each keep their own schema and identifiers for the same piece of land. A citizen today must visit multiple portals to piece together one parcel's complete picture.
                </p>
                <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-lg">
                  BhoomiSetu makes the <strong className="text-[var(--text-heading)]">parcel itself the unifying identity</strong> — resolving ULPIN, survey number, plot number, or local codes to the same canonical record, giving citizens a complete 360° view and giving officers a single workflow dashboard.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white font-medium text-sm transition shadow-xs flex items-center gap-2"
                  >
                    <span>Search a Parcel</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link
                    to="/about"
                    className="px-5 py-2.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-heading)] font-medium text-sm transition"
                  >
                    Learn More
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6 flex justify-center items-center">
                <div className="relative w-full max-w-xl">
                  <img
                    src="/bhashini-dev-team.png"
                    alt="BhoomiSetu team working on land governance platform"
                    className="w-full h-auto object-contain drop-shadow-sm rounded-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 07. HOW IT WORKS — 5 STEPS                                                 */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)]/60 py-10 sm:py-12 border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--bhashini-accent)]">How It Works</span>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--text-heading)] mt-1">From Registration to a Complete Parcel View — in 5 Steps</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {workflowSteps.map((step) => (
                <div key={step.num} className="bg-[var(--surface-1)] p-4 rounded-2xl border border-[var(--border)] shadow-xs relative">
                  <span className="text-xs font-mono font-bold text-[var(--action-500)] block mb-1">Step {step.num}</span>
                  <h4 className="font-bold text-sm text-[var(--text-heading)] mb-1">{step.title}</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-normal">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Who is this for */}
            <div className="mt-8 pt-6 border-t border-[var(--border)]">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <span className="font-bold text-xs text-[var(--text-heading)] shrink-0">Who is BhoomiSetu for?</span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {stakeholders.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full bg-[var(--surface-1)] border border-[var(--border)] text-[11px] text-[var(--text-primary)] font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 08. ARCHITECTURE SECTION 3: MILESTONES AT A GLANCE (PHONE CENTERPIECE)     */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--page-bg)] py-14 sm:py-20 border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-700)]">Platform at a Glance</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-heading)] mt-1">
                BhoomiSetu by the Numbers
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--bhashini-accent)] font-mono block">220+</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">Parcels Mapped</span>
                <span className="text-[11px] text-[var(--text-muted)]">Geo-verified cadastral units with full 360° records</span>
              </div>
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--bhashini-accent)] font-mono block">7</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">Department Feeds</span>
                <span className="text-[11px] text-[var(--text-muted)]">Land Records, Registration, Planning, Tax, Restrictions, Disputes & Encumbrance</span>
              </div>
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--action-700)] font-mono block">3</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">Portals</span>
                <span className="text-[11px] text-[var(--text-muted)]">Citizen, Officer, and Admin — role-gated with full audit trails</span>
              </div>
              <div className="p-5 bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-xs text-center">
                <span className="text-3xl sm:text-4xl font-extrabold text-[var(--bhashini-accent)] font-mono block">100%</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] block mt-1">Deterministic Decisions</span>
                <span className="text-[11px] text-[var(--text-muted)]">AI assists only — every legal action stays role-gated and logged</span>
              </div>
            </div>

            <div className="text-center mt-10">
              <Link to="/citizen" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--bhashini-accent)] hover:underline">
                <span>Sign in and explore your parcel</span>
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
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-700)]">What's Built</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--text-heading)] mt-1">
                Everything BhoomiSetu Does
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                A parcel-centric view of land governance — built to connect departments that have never talked to each other, not to replace them.
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
                <span>See All Features</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 11. BUILT FOR CITIZENS, OFFICERS & ADMINS                                  */}
        {/* ========================================================================= */}
        <section className="w-full bg-[var(--surface-2)] border-b border-[var(--action-500)]/30 py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--action-700)]">Three Portals, One Platform</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)] mt-1 leading-tight">
                Built for Every Role in Land Governance
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-[var(--surface-1)] p-6 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[var(--bhashini-accent)] mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[var(--text-heading)] mb-2">Citizens</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Search any parcel, view the complete Parcel 360° record, verify land documents against official records, raise service requests, and track their status across all departments.
                </p>
                <Link to="/citizen" className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-[var(--bhashini-accent)] hover:underline">
                  <span>Citizen Portal</span><ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="bg-[var(--surface-1)] p-6 rounded-2xl border border-[var(--action-500)]/30 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-[var(--action-500)]/15 border border-[var(--action-500)]/30 flex items-center justify-center text-[var(--action-700)] mb-4">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[var(--text-heading)] mb-2">Officers</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Review and act on citizen requests department-by-department. Receive governance alerts from satellite imagery comparison, investigate spatial changes, and maintain full audit trails.
                </p>
                <Link to="/officer" className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-[var(--action-700)] hover:underline">
                  <span>Officer Portal</span><ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="bg-[var(--surface-1)] p-6 rounded-2xl border border-[var(--border)] shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-[var(--text-heading)] mb-2">Administrators</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Manage department directories, monitor officer workloads, author GIS spatial layers, oversee platform-wide workflows, and access governance analytics across every parcel.
                </p>
                <Link to="/login" className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-[var(--text-secondary)] hover:underline">
                  <span>Admin Portal</span><ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <div className="rounded-2xl overflow-hidden border border-[var(--action-500)]/30 shadow-md max-w-2xl w-full">
                <img
                  src="/community-land.jpg"
                  alt="Citizens and officers working with BhoomiSetu land governance platform"
                  className="w-full h-auto object-cover max-h-[240px]"
                />
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
                  Government Scheme Alignment
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-heading)] leading-tight">
                  Aligned with India's Land Digitisation Initiatives
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xl">
                  BhoomiSetu is designed to work within the frameworks of SVAMITVA, ULPIN (Bhu-Aadhaar), DigiLocker, and Digital India — connecting existing department systems rather than replacing them.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {['SVAMITVA Scheme', 'ULPIN / Bhu-Aadhaar', 'Digital India', 'MeitY', 'NIC', 'DILRMP'].map((label) => (
                    <span key={label} className="px-3 py-1.5 rounded-[4px] bg-[var(--surface-1)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)]">{label}</span>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 bg-[var(--surface-2)] p-5 rounded-[8px] border border-[var(--border)]">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-3">
                  What BhoomiSetu Connects
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  {['Land Records', 'Registration', 'Town Planning', 'Taxation', 'Restrictions', 'Disputes', 'Encumbrance', 'Spatial / GIS'].map((d) => (
                    <div key={d} className="p-2.5 bg-[var(--surface-1)] rounded border border-[var(--border)] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--bhashini-accent)] shrink-0" />
                      {d}
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
              Ready to Get Started? Make Your Land Verifiable Today
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto font-medium">
              Join thousands of citizens, revenue officers, and certified surveyors building India's single, verifiable GIS land registry.
            </p>
            <div className="pt-2">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--bhashini-accent)] hover:bg-[var(--brand-700)] text-white font-bold text-sm tracking-wide transition shadow-md"
              >
                <span>Access BhoomiSetu Portal</span>
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
                {t.tickerLabel}
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
