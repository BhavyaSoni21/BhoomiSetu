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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ParcelSearchModal from '../components/landing/ParcelSearchModal';
import { useTheme } from '../theme/theme';
import { setStoredLanguage } from '../i18n/config';
import apiService from '../services/apiService';
import MapComponent from '../features/map/MapComponent';
import { ParcelSummary } from '../types/parcel';

export const BhoomiSetuLanding: React.FC = () => {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const { i18n } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Kept in sync with the app-wide i18next language (not a separate,
  // disconnected toggle) - this page previously had its own local-only
  // EN/HI state, so switching to Hindi here didn't carry over once the
  // citizen navigated to Login/Register or any signed-in portal page, and
  // vice versa. i18n.language is 'English'/'Hindi' (see i18n/config.ts);
  // this page's own content object below is keyed 'EN'/'HI', so the two
  // still need a small mapping at the read/write boundary.
  const [language, setLanguage] = useState<'EN' | 'HI'>(i18n.language === 'Hindi' ? 'HI' : 'EN');
  const changeLanguage = (next: 'EN' | 'HI') => {
    setLanguage(next);
    const i18nLang = next === 'HI' ? 'Hindi' : 'English';
    i18n.changeLanguage(i18nLang);
    setStoredLanguage(i18nLang);
  };
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Real Pune cluster data for the "Live GIS Preview" section below -
  // replaces a hand-drawn SVG mockup grid of fake parcel statuses. Locked to
  // Pune specifically (state=MH, district=PUN - the one cluster with the
  // richest demo data: zoning/restriction/infrastructure/change-detection
  // overlays), not affected by anything a visitor does elsewhere on the page.
  const { data: puneParcelsData } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['landing-pune-cluster'],
    async () => (await apiService.get('/parcels', { params: { state: 'MH', district: 'PUN', limit: 500 } })).data,
  );
  const puneParcels = puneParcelsData?.parcels ?? [];

  // Handle scroll detection for floating navbar state
  useEffect(() => {
    const handleScroll = () => {
      // Transition navbar once scrolled 80px or past the top hero region
      if (window.scrollY > 80) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Text strings for bilingual support
  const content = {
    EN: {
      nav: {
        about: 'About',
        features: 'Features',
        loginRegister: 'Login / Register',
      },
      hero: {
        eyebrow: 'GIS-BASED LAND GOVERNANCE',
        headlineLine1: 'ONE PARCEL.',
        headlineLine2: 'EVERY RECORD.',
        body: 'Connecting fragmented land data into a single, verifiable view.',
        searchCta: 'Search a Parcel',
        signInCta: 'Get Started',
        badge: 'BhoomiSetu',
        footerStrip: 'GOVERNMENT OF INDIA | DIGITAL INDIA | SVAMITVA SCHEME',
      },
      stats: [
        { value: '220', label: 'PARCELS MAPPED' },
        { value: '5', label: 'PILOT STATES' },
        { value: '7', label: 'DEPARTMENT FEEDS' },
        { value: 'Live', label: 'GIS LAYERS', isLive: true },
      ],
      howItWorks: {
        eyebrow: 'HOW IT WORKS',
        heading: 'Four steps from plot to proof.',
        steps: [
          {
            num: '01',
            title: 'Search a Parcel',
            desc: 'Look up any plot by ULPIN, survey number, or local ID.',
            icon: Search,
          },
          {
            num: '02',
            title: 'View Parcel 360',
            desc: 'See ownership, departments, and records in one unified view.',
            icon: Layers,
          },
          {
            num: '03',
            title: 'Verify Documents',
            desc: 'OCR-check any land document against canonical records.',
            icon: FileCheck2,
          },
          {
            num: '04',
            title: 'File a Request',
            desc: 'Raise a workflow with any department and track it live.',
            icon: ArrowRight,
          },
        ],
      },
      gisPreview: {
        eyebrow: 'LIVE GIS PREVIEW',
        heading: 'One map. Five states. Zero ambiguity.',
        body: 'Every parcel carries a verifiable status — from clean title to active dispute. Officers and citizens see the same truth, colored the same way, in real time.',
        legend: [
          { label: 'Verified', color: '#166534' },
          { label: 'Selected', color: '#D97706' },
          { label: 'Pending', color: '#F59E0B', isDashed: true },
          { label: 'Disputed', color: '#DC2626' },
          { label: 'High-Risk', color: '#92400E' },
        ],
      },
      interoperability: {
        eyebrow: 'INTEROPERABILITY',
        heading: 'Seven department feeds. One record.',
        feeds: [
          { name: 'Land Records', icon: FileText },
          { name: 'Registration', icon: FileCheck2 },
          { name: 'Planning', icon: Building2 },
          { name: 'Tax', icon: Receipt },
          { name: 'Restriction', icon: ShieldAlert },
          { name: 'Dispute', icon: Scale },
          { name: 'Encumbrance', icon: Lock },
        ],
      },
      landAgri: {
        eyebrow: 'LAND & AGRICULTURE',
        heading: 'The land, beyond the ledger.',
        body: 'BhoomiSetu layers agricultural metadata — extent, land use, mutation history, and valuation — alongside legal records, so every parcel tells its full story.',
        snapshotBadge: 'PARCEL SNAPSHOT',
        snapshotTitle: 'Survey No. 142 — Kharif & Rabi cycles tracked since 2019.',
        metadata: [
          { label: 'Canonical extent', value: '2.31 ha', icon: Crop },
          { label: 'Land use', value: 'Double-crop agri', icon: Layers },
          { label: 'Last mutation', value: 'Mar 2024', icon: Calendar },
          { label: 'Valuation band', value: 'Tier-II', icon: TrendingUp },
        ],
      },
      closingCta: {
        heading: 'Ready to see your land, clearly?',
        body: 'Search any parcel by ULPIN, survey number, or plot number — and get a single, verifiable view in seconds.',
        searchButton: 'Search a Parcel',
        signInButton: 'Get Started',
      },
      footer: {
        desc: 'A GIS-based land governance and interoperability platform — connecting fragmented land data into a single, verifiable view.',
        platformTitle: 'Platform',
        platformLinks: ['Search a Parcel', 'Parcel 360', 'Verify Documents', 'Live Map'],
        portalsTitle: 'Portals',
        portalsLinks: ['Citizen Portal', 'Officer Portal', 'Admin Portal'],
        aboutTitle: 'About',
        aboutLinks: ['Mission', 'Pilot States', 'Interoperability', 'Contact'],
        copyright: '© 2026 BhoomiSetu • Government land governance initiative',
        privacy: 'Privacy',
        terms: 'Terms',
        accessibility: 'Accessibility',
      },
    },
    HI: {
      nav: {
        about: 'परिचय',
        features: 'विशेषताएं',
        loginRegister: 'लॉगिन / पंजीकरण करें',
      },
      hero: {
        eyebrow: 'जीआईएस-आधारित भूमि शासन',
        headlineLine1: 'एक भूखंड.',
        headlineLine2: 'प्रत्येक अभिलेख.',
        body: 'खंडित भूमि डेटा को एक एकल, सत्यापन योग्य दृश्य में जोड़ना।',
        searchCta: 'भूखंड खोजें',
        signInCta: 'शुरू करें',
        badge: 'भूमिसेतु',
        footerStrip: 'भारत सरकार | डिजिटल इंडिया | स्वामित्व योजना',
      },
      stats: [
        { value: '220', label: 'भूखंड मानचित्रित' },
        { value: '5', label: 'पायलट राज्य' },
        { value: '7', label: 'विभागीय फ़ीड्स' },
        { value: 'लाइव', label: 'जीआईएस परतें', isLive: true },
      ],
      howItWorks: {
        eyebrow: 'प्रक्रिया विवरण',
        heading: 'भूखंड से प्रमाण तक चार चरण।',
        steps: [
          {
            num: '01',
            title: 'भूखंड खोजें',
            desc: 'यूलपिन (ULPIN), सर्वेक्षण संख्या या स्थानीय आईडी द्वारा कोई भी भूखंड देखें।',
            icon: Search,
          },
          {
            num: '02',
            title: 'भूखंड 360° देखें',
            desc: 'स्वामित्व, विभाग और रिकॉर्ड एक एकीकृत दृश्य में देखें।',
            icon: Layers,
          },
          {
            num: '03',
            title: 'दस्तावेज़ सत्यापित करें',
            desc: 'प्रामाणिक रिकॉर्ड के विरुद्ध भूमि दस्तावेजों की ओसीआर जांच करें।',
            icon: FileCheck2,
          },
          {
            num: '04',
            title: 'अनुरोध दर्ज करें',
            desc: 'किसी भी विभाग के साथ कार्यप्रवाह शुरू करें और लाइव ट्रैक करें।',
            icon: ArrowRight,
          },
        ],
      },
      gisPreview: {
        eyebrow: 'लाइव जीआईएस पूर्वावलोकन',
        heading: 'एक मानचित्र। पाँच राज्य। शून्य अस्पष्टता।',
        body: 'प्रत्येक भूखंड एक सत्यापन योग्य स्थिति रखता है — स्वच्छ शीर्षक से लेकर सक्रिय विवाद तक। अधिकारी और नागरिक एक ही सत्य को वास्तविक समय में देखते हैं।',
        legend: [
          { label: 'सत्यापित', color: '#166534' },
          { label: 'चयनित', color: '#D97706' },
          { label: 'लंबित', color: '#F59E0B', isDashed: true },
          { label: 'विवादित', color: '#DC2626' },
          { label: 'उच्च-जोखिम', color: '#92400E' },
        ],
      },
      interoperability: {
        eyebrow: 'अंतर-संचालनीयता',
        heading: 'सात विभागीय फ़ीड्स। एक अभिलेख।',
        feeds: [
          { name: 'भूमि रिकॉर्ड', icon: FileText },
          { name: 'पंजीकरण', icon: FileCheck2 },
          { name: 'टाउन प्लानिंग', icon: Building2 },
          { name: 'राजस्व कर', icon: Receipt },
          { name: 'प्रतिबंध', icon: ShieldAlert },
          { name: 'विवाद', icon: Scale },
          { name: 'भार/बंधक', icon: Lock },
        ],
      },
      landAgri: {
        eyebrow: 'भूमि एवं कृषि',
        heading: 'बहीखाते से परे, भूमि की संपूर्ण जानकारी।',
        body: 'भूमिसेतु कानूनी रिकॉर्ड के साथ-साथ कृषि मेटाडेटा — क्षेत्रफल, भूमि उपयोग, म्यूटेशन इतिहास और मूल्यांकन को प्रदर्शित करता है।',
        snapshotBadge: 'भूखंड स्नैपशॉट',
        snapshotTitle: 'सर्वेक्षण सं. 142 — 2019 से खरीफ और रबी चक्र ट्रैक किए गए।',
        metadata: [
          { label: 'प्रामाणिक क्षेत्रफल', value: '2.31 हेक्टेयर', icon: Crop },
          { label: 'भूमि उपयोग', value: 'द्वि-फसली कृषि', icon: Layers },
          { label: 'अंतिम म्यूटेशन', value: 'मार्च 2024', icon: Calendar },
          { label: 'मूल्यांकन श्रेणी', value: 'टियर-II', icon: TrendingUp },
        ],
      },
      closingCta: {
        heading: 'अपनी भूमि को स्पष्ट रूप से देखने के लिए तैयार हैं?',
        body: 'यूलपिन, सर्वेक्षण संख्या, या भूखंड संख्या द्वारा खोजें — और सेकंडों में एकल, सत्यापन योग्य दृश्य प्राप्त करें।',
        searchButton: 'भूखंड खोजें',
        signInButton: 'शुरू करें',
      },
      footer: {
        desc: 'एक जीआईएस-आधारित भूमि शासन और अंतर-संचालनीयता मंच — खंडित भूमि डेटा को एक एकल, सत्यापन योग्य दृश्य में जोड़ता है।',
        platformTitle: 'मंच',
        platformLinks: ['भूखंड खोजें', 'भूखंड 360°', 'दस्तावेज़ सत्यापन', 'लाइव मानचित्र'],
        portalsTitle: 'पोर्टल',
        portalsLinks: ['नागरिक पोर्टल', 'अधिकारी पोर्टल', 'प्रशासन पोर्टल'],
        aboutTitle: 'के बारे में',
        aboutLinks: ['उद्देश्य', 'पायलट राज्य', 'अंतर-संचालनीयता', 'संपर्क'],
        copyright: '© 2026 भूमिसेतु • भारत सरकार भूमि शासन पहल',
        privacy: 'गोपनीयता',
        terms: 'नियम व शर्तें',
        accessibility: 'सुगम्यता',
      },
    },
  };

  const t = content[language];

  return (
    <div className="min-h-screen bg-[#F7FAF5] dark:bg-[#0a1a13] text-[#34413A] dark:text-[#F7FAF5] font-sans selection:bg-[#F59E0B] selection:text-black">
      {/* ========================================================================= */}
      {/* 1. FLOATING GLASSMORPHISM NAVBAR                                          */}
      {/* ========================================================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 sm:px-6 pt-4 pointer-events-none transition-all duration-300">
        <div
          className={`w-full max-w-7xl h-14 sm:h-[56px] px-4 sm:px-6 rounded-2xl flex items-center justify-between pointer-events-auto transition-all duration-300 ${
            isScrolled
              ? 'bg-[#0F3D2E]/95 dark:bg-[#0a1a13]/95 backdrop-blur-md shadow-lg border border-white/20'
              : 'bg-white/10 dark:bg-black/25 backdrop-blur-[40px] border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.25)]'
          }`}
        >
          {/* Left: Minimal Geometric Logo */}
          <Link to="/" className="flex items-center gap-2.5 focus:outline-none group">
            <img
              src="/apple-touch-icon.png"
              alt="BhoomiSetu"
              className="w-6 h-6 rounded-md transition-transform group-hover:scale-105"
            />
            <span className="font-heading font-bold text-lg sm:text-xl text-white tracking-tight">
              BhoomiSetu
            </span>
          </Link>

          {/* Center Links (Inter 14px, medium, white/75, hover white) */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/75">
            <a href="#about" className="hover:text-white transition-colors duration-150">
              {t.nav.about}
            </a>
            <a href="#features" className="hover:text-white transition-colors duration-150">
              {t.nav.features}
            </a>
          </nav>

          {/* Right: Language Pill Toggle + Theme Toggle */}
          <div className="flex items-center gap-3">
            {/* Language Pill Toggle EN / हिंदी */}
            <div className="flex items-center p-0.5 rounded-full bg-black/25 border border-white/20 text-xs font-semibold">
              <button
                type="button"
                onClick={() => changeLanguage('EN')}
                className={`px-2.5 py-1 rounded-full transition-all duration-150 ${
                  language === 'EN'
                    ? 'bg-[#F59E0B] text-[#16241A] font-bold shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => changeLanguage('HI')}
                className={`px-2.5 py-1 rounded-full transition-all duration-150 ${
                  language === 'HI'
                    ? 'bg-[#F59E0B] text-[#16241A] font-bold shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
                aria-label="Switch to Hindi"
              >
                हिंदी
              </button>
            </div>

            {/* Dark/Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-[#F59E0B]" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Single common entry point - right-aligned, last item before the
                mobile hamburger takes over below md */}
            <Link
              to="/login"
              className="hidden md:inline-flex px-4 py-1.5 rounded-full bg-[#F59E0B] text-[#16241A] font-heading font-bold text-xs uppercase tracking-wide hover:brightness-105 transition whitespace-nowrap"
            >
              {t.nav.loginRegister}
            </Link>

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-18 left-4 right-4 bg-[#0F3D2E]/95 dark:bg-[#0a1a13]/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-5 shadow-2xl space-y-3 pointer-events-auto md:hidden animate-fadeIn">
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 font-medium text-sm"
            >
              {t.nav.about}
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 font-medium text-sm"
            >
              {t.nav.features}
            </a>
            <div className="pt-2 border-t border-white/15 flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsSearchModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl border border-white/25 text-white font-heading font-bold text-xs uppercase tracking-wider"
              >
                {t.hero.searchCta}
              </button>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 rounded-xl bg-[#F59E0B] text-[#16241A] font-heading font-bold text-xs uppercase tracking-wider text-center whitespace-nowrap"
              >
                {t.nav.loginRegister}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION (~92vh)                                                   */}
      {/* ========================================================================= */}
      <section className="relative w-full h-[92vh] min-h-[640px] max-h-[960px] flex flex-col justify-between overflow-hidden">
        {/* Full-bleed aerial photo background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/Background.jpeg')" }}
          role="img"
          aria-label="Aerial drone photograph of Indian farmland with crop fields, trees, and village cluster"
        />

        {/* Scrim: ONLY left-to-right linear gradient (rgba(6,21,15,0.95) to transparent at ~62%) + subtle vignettes */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(6, 21, 15, 0.96) 0%, rgba(6, 21, 15, 0.88) 32%, rgba(6, 21, 15, 0.5) 48%, rgba(6, 21, 15, 0) 62%)',
          }}
        />
        {/* Very subtle top and bottom vignettes */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(6, 21, 15, 0.4) 0%, transparent 18%, transparent 82%, rgba(6, 21, 15, 0.6) 100%)',
          }}
        />

        {/* Hero Content - Vertically centered, left-aligned */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 my-auto pt-24 sm:pt-28">
          <div className="max-w-2xl space-y-6 sm:space-y-7">
            {/* Eyebrow */}
            <div className="inline-block">
              <span className="text-white text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] opacity-90">
                {t.hero.eyebrow}
              </span>
            </div>

            {/* Bold uppercase Montserrat headline */}
            <h1 className="font-heading font-extrabold uppercase text-white tracking-tight leading-[1.08] text-4xl sm:text-6xl lg:text-[72px]">
              {t.hero.headlineLine1}
              <br />
              {t.hero.headlineLine2}
            </h1>

            {/* Body copy: 17-18px Inter, white/85, max-w ~28rem */}
            <p className="text-white/85 text-base sm:text-[18px] leading-relaxed max-w-[28rem] font-normal">
              {t.hero.body}
            </p>

            {/* Two Pill CTAs below */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              {/* (1) Search a Parcel CTA - metallic light-gray vertical gradient */}
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(true)}
                className="btn-brushed-metal inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-heading font-bold text-sm sm:text-base cursor-pointer tracking-wide"
              >
                <Search className="w-4 h-4 text-[#16241A]" />
                <span>{t.hero.searchCta}</span>
              </button>

              {/* (2) Get Started CTA - transparent glass */}
              <Link
                to="/register"
                className="btn-hero-glass inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-heading font-medium text-sm sm:text-base cursor-pointer tracking-wide"
              >
                <span>{t.hero.signInCta}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Hero Bottom Area */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 space-y-4">
          {/* Bottom hairline + row of tracked government labels */}
          <div className="pt-3 border-t border-white/25">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              <span>GOVERNMENT OF INDIA</span>
              <span className="text-white/30">|</span>
              <span>DIGITAL INDIA</span>
              <span className="text-white/30">|</span>
              <span>SVAMITVA SCHEME</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. TRUST STATS STRIP ON WHITE                                             */}
      {/* ========================================================================= */}
      <section className="w-full bg-white dark:bg-[#122b20] border-b border-black/10 dark:border-white/10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black/10 dark:divide-white/10">
            {t.stats.map((stat, idx) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center justify-center text-center p-4 ${
                  idx > 1 ? 'pt-6 md:pt-4' : ''
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-bold text-3xl sm:text-4xl lg:text-[44px] text-[#0F3D2E] dark:text-white tracking-tight">
                    {stat.value}
                  </span>
                  {stat.isLive && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#166534] dark:bg-emerald-400 animate-pulse mt-1" />
                  )}
                </div>
                <span className="text-xs sm:text-[13px] font-semibold uppercase tracking-wider text-[#718078] dark:text-white/60 mt-1">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. HOW IT WORKS SECTION (LIGHT THEME, 96PX VERTICAL PADDING)              */}
      {/* ========================================================================= */}
      <section id="features" className="w-full py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-4 max-w-2xl mb-12 sm:mb-16">
          {/* Eyebrow: mono, tracked, amber */}
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
            {t.howItWorks.eyebrow}
          </div>
          {/* Montserrat bold heading */}
          <h2 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-[#0F3D2E] dark:text-white tracking-tight leading-tight">
            {t.howItWorks.heading}
          </h2>
        </div>

        {/* 4-step grid of white cards with thin borders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.howItWorks.steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-white dark:bg-[#143225] rounded-2xl p-6 sm:p-7 border border-black/10 dark:border-white/10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[#F7FAF5] dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center text-[#0F3D2E] dark:text-white group-hover:bg-[#0F3D2E] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#718078] dark:text-white/60">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-lg text-[#0F3D2E] dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#53635A] dark:text-white/70 leading-relaxed font-normal">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. LIVE GIS PREVIEW (TWO-COLUMN WITH STYLIZED SVG GRID)                   */}
      {/* ========================================================================= */}
      <section className="w-full bg-[#F1F5EF] dark:bg-[#0e241b] py-20 sm:py-24 border-y border-black/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Eyebrow, Heading, Body Copy, Color Legend */}
            <div className="lg:col-span-5 space-y-6">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
                {t.gisPreview.eyebrow}
              </div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-[#0F3D2E] dark:text-white tracking-tight leading-tight">
                {t.gisPreview.heading}
              </h2>
              <p className="text-[#53635A] dark:text-white/75 text-base sm:text-[17px] leading-relaxed">
                {t.gisPreview.body}
              </p>

              {/* Quick Action to open search */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsSearchModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] text-white font-heading font-semibold text-xs uppercase tracking-wider transition shadow-sm"
                >
                  <Search className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Inspect Cadastral Plot</span>
                </button>
              </div>
            </div>

            {/* Right Column: Stylized SVG Parcel Grid Card */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#143225] rounded-2xl border border-black/10 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
                {/* Header row of the card */}
                <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#166534] animate-pulse" />
                    <span className="font-heading font-bold text-sm text-[#0F3D2E] dark:text-white">
                      Pune Cluster
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#718078] dark:text-white/60 font-semibold">
                    18.52°N · 73.85°E
                  </span>
                </div>

                {/* The real Pune cluster, not a mockup - MapComponent fetches
                    live parcel geometry via /gis/parcels + real spatial
                    context, so this is the same map the Citizen/Officer
                    Portals use, just handed only Pune's own parcels and
                    locked to them (no search box, no layer switching to a
                    different cluster) for this preview. */}
                <div className="bg-[#F7FAF5]/50 dark:bg-black/20">
                  <MapComponent parcels={puneParcels} fitToParcels showLayerPanel={false} />
                </div>

                {/* Footer of the card */}
                <div className="px-6 py-3.5 bg-gray-50/70 dark:bg-black/20 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-[#53635A] dark:text-white/70">
                    <MapPin className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>{puneParcels.length} parcels · PostGIS-backed</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#166534]/15 text-[#166534] dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold text-[11px] border border-[#166534]/20">
                    Live Data
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. INTEROPERABILITY BAND                                                  */}
      {/* ========================================================================= */}
      <section className="w-full py-20 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-2xl mx-auto space-y-3 mb-10 sm:mb-12">
          {/* Centered eyebrow: mono, amber, tracked */}
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
            {t.interoperability.eyebrow}
          </div>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-[#0F3D2E] dark:text-white tracking-tight">
            {t.interoperability.heading}
          </h2>
        </div>

        {/* 7 pill badges in a wrap row */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
          {t.interoperability.feeds.map((feed) => {
            const Icon = feed.icon;
            return (
              <div
                key={feed.name}
                className="w-36 sm:w-40 h-12 flex items-center justify-center gap-2.5 px-3 rounded-xl bg-white dark:bg-[#143225] border border-black/10 dark:border-white/10 text-[#0F3D2E] dark:text-white shadow-xs hover:border-[#166534] hover:shadow-sm transition-all duration-150 cursor-default"
              >
                <Icon className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
                <span className="font-heading font-semibold text-xs sm:text-sm tracking-tight whitespace-nowrap">
                  {feed.name}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. LAND & AGRICULTURE SECTION (EARTH-TONE ACCENTS)                       */}
      {/* ========================================================================= */}
      <section id="about" className="w-full bg-[#F7FAF5] dark:bg-[#0a1a13] py-20 sm:py-24 border-t border-black/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left: Stylized Land Parcel Visual Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#92400E] via-[#B45309] to-[#78350F] p-8 sm:p-10 text-white shadow-xl min-h-[340px] flex flex-col justify-between">
                {/* Subtle organic topographic curves in background */}
                <div className="absolute inset-0 opacity-15 pointer-events-none" aria-hidden="true">
                  <svg className="w-full h-full" viewBox="0 0 400 300" fill="none">
                    <path
                      d="M0 80 Q100 40, 200 100 T400 60 L400 300 L0 300 Z"
                      fill="#FFFFFF"
                    />
                    <path
                      d="M0 160 Q120 120, 240 180 T400 140 L400 300 L0 300 Z"
                      fill="#FFFFFF"
                      fillOpacity="0.5"
                    />
                  </svg>
                </div>

                <div className="relative z-10 space-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/80 font-bold">
                    {t.landAgri.snapshotBadge}
                  </span>
                </div>

                <div className="relative z-10">
                  <h3 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
                    {t.landAgri.snapshotTitle}
                  </h3>
                </div>
              </div>
            </div>

            {/* Right: Eyebrow, Heading, Body & Metadata Grid */}
            <div className="lg:col-span-7 space-y-6">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#D97706] dark:text-[#F59E0B]">
                {t.landAgri.eyebrow}
              </div>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-[#0F3D2E] dark:text-white tracking-tight leading-tight">
                {t.landAgri.heading}
              </h2>
              <p className="text-[#53635A] dark:text-white/75 text-base leading-relaxed">
                {t.landAgri.body}
              </p>

              {/* Grid of metadata cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {t.landAgri.metadata.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="p-4 rounded-xl bg-white dark:bg-[#143225] border border-black/10 dark:border-white/10 shadow-xs flex items-center gap-3.5"
                    >
                      <div className="p-2.5 rounded-lg bg-[#F7FAF5] dark:bg-white/10 text-[#92400E] dark:text-[#F59E0B] shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-white/60">
                          {item.label}
                        </span>
                        <span className="font-mono font-bold text-sm text-[#0F3D2E] dark:text-white">
                          {item.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. CLOSING CTA (ROUNDED-3XL AMBER #D97706 PANEL WITH RADIAL GLOW)         */}
      {/* ========================================================================= */}
      <section className="w-full py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-[#D97706] text-[#16241A] p-8 sm:p-14 lg:p-16 overflow-hidden shadow-xl">
          {/* Radial white glow at top-right at 30% opacity */}
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 70%)',
            }}
          />

          <div className="relative z-10 max-w-2xl space-y-4">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-[#16241A] tracking-tight leading-tight">
              {t.closingCta.heading}
            </h2>
            <p className="text-[#2b1803] text-base sm:text-lg leading-relaxed font-medium">
              {t.closingCta.body}
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-4">
              {/* Dark green button */}
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] text-white font-heading font-bold text-sm sm:text-base tracking-wide transition shadow-md"
              >
                <Search className="w-4 h-4 text-[#F59E0B]" />
                <span>{t.closingCta.searchButton}</span>
              </button>

              {/* Glass dark button */}
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-black/10 hover:bg-black/15 border border-black/20 text-[#16241A] font-heading font-semibold text-sm sm:text-base tracking-wide transition"
              >
                <span>{t.closingCta.signInButton}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. FOOTER (DEEP FOREST GREEN #0F3D2E)                                     */}
      {/* ========================================================================= */}
      <footer className="w-full bg-[#0F3D2E] text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            {/* Brand Column */}
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <img src="/apple-touch-icon.png" alt="BhoomiSetu" className="w-6 h-6 rounded-md" />
                <span className="font-heading font-bold text-xl text-white tracking-tight">
                  BhoomiSetu
                </span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed max-w-sm font-normal">
                {t.footer.desc}
              </p>
            </div>

            {/* Three Link Columns: Platform, Portals, About */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
              {/* Platform */}
              <div className="space-y-3">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                  {t.footer.platformTitle}
                </h4>
                <ul className="space-y-2 text-sm text-white/70">
                  {t.footer.platformLinks.map((link) => (
                    <li key={link}>
                      <button
                        type="button"
                        onClick={() => setIsSearchModalOpen(true)}
                        className="hover:text-white transition text-left"
                      >
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Portals */}
              <div className="space-y-3">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                  {t.footer.portalsTitle}
                </h4>
                <ul className="space-y-2 text-sm text-white/70">
                  <li>
                    <Link to="/citizen" className="hover:text-white transition">
                      Citizen Portal
                    </Link>
                  </li>
                  <li>
                    <Link to="/officer" className="hover:text-white transition">
                      Officer Portal
                    </Link>
                  </li>
                  <li>
                    <Link to="/admin" className="hover:text-white transition">
                      Admin Portal
                    </Link>
                  </li>
                </ul>
              </div>

              {/* About */}
              <div className="space-y-3">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                  {t.footer.aboutTitle}
                </h4>
                <ul className="space-y-2 text-sm text-white/70">
                  {t.footer.aboutLinks.map((link) => (
                    <li key={link}>
                      <a href="#about" className="hover:text-white transition">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Hairline Row */}
          <div className="pt-8 mt-12 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60">
            <span>{t.footer.copyright}</span>
            <div className="flex items-center gap-6">
              <a href="#privacy" className="hover:text-white transition">
                {t.footer.privacy}
              </a>
              <a href="#terms" className="hover:text-white transition">
                {t.footer.terms}
              </a>
              <a href="#accessibility" className="hover:text-white transition">
                {t.footer.accessibility}
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Parcel Search Modal */}
      <ParcelSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
};

export default BhoomiSetuLanding;
