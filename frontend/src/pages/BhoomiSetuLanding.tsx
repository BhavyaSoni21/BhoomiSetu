import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ParcelSearchModal from '../components/landing/ParcelSearchModal';
import { useTheme } from '../theme/theme';
import { setStoredLanguage } from '../i18n/config';
import apiService from '../services/apiService';
import { ParcelSummary } from '../types/parcel';
import { useAuthUser } from '../features/auth/auth';
import { LANDING_CONTENT, LandingLanguage } from './landing/content';
import LandingNavbar from './landing/LandingNavbar';
import LandingHero from './landing/LandingHero';
import LandingStatsStrip from './landing/LandingStatsStrip';
import LandingHowItWorks from './landing/LandingHowItWorks';
import LandingGisPreview from './landing/LandingGisPreview';
import LandingInteroperability from './landing/LandingInteroperability';
import LandingLandAgriculture from './landing/LandingLandAgriculture';
import LandingClosingCta from './landing/LandingClosingCta';
import LandingFooter from './landing/LandingFooter';

// KNOWN_RISKS.md LOW-3: this used to be one 951-line component. The nine
// numbered sections below are now their own components under ./landing/ -
// this file is left holding only the state/data every section actually
// needs (auth, theme, language, scroll, the search modal, the live Pune
// cluster query) and composing them in order. Markup/behavior unchanged.
export const BhoomiSetuLanding: React.FC = () => {
  const [theme, toggleTheme] = useTheme();
  const { i18n } = useTranslation();
  // Reuses the same cached /auth/me result App.tsx's AppShell already
  // fetched (same React Query key) - no extra request. This page's own
  // floating navbar is a guest-only presentation; a signed-in citizen gets
  // AppShell's real nav instead (App.tsx's hideChromeForLanding), so
  // showing both here would stack two navbars on top of each other.
  const { data: authUser } = useAuthUser();
  const isGuest = !authUser;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Kept in sync with the app-wide i18next language (not a separate,
  // disconnected toggle) - this page previously had its own local-only
  // EN/HI state, so switching to Hindi here didn't carry over once the
  // citizen navigated to Login/Register or any signed-in portal page, and
  // vice versa. i18n.language is 'English'/'Hindi' (see i18n/config.ts);
  // this page's own content object below is keyed 'EN'/'HI', so the two
  // still need a small mapping at the read/write boundary.
  const [language, setLanguage] = useState<LandingLanguage>(i18n.language === 'Hindi' ? 'HI' : 'EN');
  const changeLanguage = (next: LandingLanguage) => {
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

  const t = LANDING_CONTENT[language];

  return (
    <div className="min-h-screen bg-[#F7FAF5] dark:bg-[#0a1a13] text-[#34413A] dark:text-[#F7FAF5] font-sans selection:bg-[#F59E0B] selection:text-black">
      <LandingNavbar
        t={t}
        isGuest={isGuest}
        isScrolled={isScrolled}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        language={language}
        changeLanguage={changeLanguage}
        theme={theme}
        toggleTheme={toggleTheme}
        setIsSearchModalOpen={setIsSearchModalOpen}
      />
      <LandingHero t={t} setIsSearchModalOpen={setIsSearchModalOpen} />
      <LandingStatsStrip t={t} />
      <LandingHowItWorks t={t} />
      <LandingGisPreview t={t} puneParcels={puneParcels} setIsSearchModalOpen={setIsSearchModalOpen} />
      <LandingInteroperability t={t} />
      <LandingLandAgriculture t={t} />
      <LandingClosingCta t={t} setIsSearchModalOpen={setIsSearchModalOpen} />
      <LandingFooter t={t} setIsSearchModalOpen={setIsSearchModalOpen} />

      {/* Parcel Search Modal */}
      <ParcelSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
};

export default BhoomiSetuLanding;
