import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ParcelSearchModal from '../components/landing/ParcelSearchModal';
import { setStoredLanguage } from '../i18n/config';
import apiService from '../services/apiService';
import { ParcelSummary } from '../types/parcel';
import { LANDING_CONTENT, LandingLanguage } from './landing/content';
import LandingHero from './landing/LandingHero';
import LandingStatsStrip from './landing/LandingStatsStrip';
import LandingHowItWorks from './landing/LandingHowItWorks';
import LandingGisPreview from './landing/LandingGisPreview';
import LandingInteroperability from './landing/LandingInteroperability';
import LandingLandAgriculture from './landing/LandingLandAgriculture';
import LandingClosingCta from './landing/LandingClosingCta';

// KNOWN_RISKS.md LOW-3: this used to be one 951-line component. The nine
// numbered sections below are now their own components under ./landing/ -
// this file is left holding only the state/data every section actually
// needs (theme, language, scroll, the search modal, the live Pune cluster
// query) and composing them in order. Markup/behavior unchanged.
//
// This page no longer renders its own navbar/footer - App.tsx's AppShell
// shows the same unified navbar and no footer on every page, landing page
// included, so a second floating navbar here would just duplicate it.
export const BhoomiSetuLanding: React.FC = () => {
  const { i18n } = useTranslation();
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

  const t = LANDING_CONTENT[language];

  return (
    <div className="min-h-screen bg-[#F7FAF5] dark:bg-[#0a1a13] text-[#34413A] dark:text-[#F7FAF5] font-sans selection:bg-[#F59E0B] selection:text-black">
      <LandingHero t={t} setIsSearchModalOpen={setIsSearchModalOpen} />
      <LandingStatsStrip t={t} />
      <LandingHowItWorks t={t} />
      <LandingGisPreview t={t} puneParcels={puneParcels} setIsSearchModalOpen={setIsSearchModalOpen} />
      <LandingInteroperability t={t} />
      <LandingLandAgriculture t={t} />
      <LandingClosingCta t={t} setIsSearchModalOpen={setIsSearchModalOpen} />

      {/* Parcel Search Modal */}
      <ParcelSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
    </div>
  );
};

export default BhoomiSetuLanding;
