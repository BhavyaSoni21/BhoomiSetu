import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { Mail, Phone, MapPin, Youtube, Facebook, Twitter, Instagram, Linkedin, ArrowUpRight } from 'lucide-react';
import { usePwaInstall } from '../features/pwa/usePwaInstall';

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const { canInstall, installed, isIOS, promptInstall } = usePwaInstall();
  const [showHint, setShowHint] = useState(false);

  // Explicit user action -> native consent dialog. Where no prompt is available
  // (iOS Safari, or the event hasn't fired), show manual add-to-home-screen steps.
  const handleInstall = async () => {
    if (canInstall) {
      await promptInstall();
      return;
    }
    setShowHint(true);
  };

  return (
    <footer className="w-full bg-[var(--brand-900)] text-white/85 border-t border-white/10 relative z-10 transition-colors duration-200">
      {/* Upper Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">

          {/* Column 1: Logo, Address, Contact (Spans 5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* White card container for logo - exact design from government portal screenshot */}
            <div className="inline-flex items-center gap-3 bg-white px-4 py-2.5 rounded-lg border border-white/20 shadow-md">
              <img
                src="/logo-header.png"
                alt="BhoomiSetu Logo"
                className="h-9 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="flex flex-col">
                <span className="text-xl font-bold font-heading text-[#0F3D2E] tracking-tight leading-none">
                  Bhoomi<span className="text-[#208A43]">Setu</span>
                </span>
                <span className="text-[10px] text-gray-600 font-semibold tracking-wider uppercase mt-0.5">
                  {t('footer.tagline')}
                </span>
              </div>
            </div>

            {/* Department info */}
            <div className="space-y-1 text-xs">
              <h3 className="font-bold text-white text-sm tracking-wide">
                {t('footer.departmentHeading')}
              </h3>
              <p className="text-white/70 text-[11px] font-medium">
                Ministry of Rural Development, Government of India
              </p>
              <p className="text-white/60 text-[11px] flex items-start gap-1.5 pt-1">
                <MapPin className="w-3.5 h-3.5 text-[var(--action-500)] shrink-0 mt-0.5" />
                <span>{t('footer.address')}</span>
              </p>
            </div>

            {/* Contact details */}
            <div className="pt-2 space-y-1.5 text-xs text-white/90">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--action-500)] shrink-0" />
                <span className="font-mono text-[11px] text-white/90">
                  helpdesk@bhoomisetu.gov.in
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[var(--action-500)] shrink-0" />
                <span className="font-mono text-[11px] text-white/90">
                  {t('footer.helplineLabel')}: <strong className="text-white">1800-11-2026</strong> / 011-2430 1361
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links (Spans 2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--action-500)] font-heading">
              {t('footer.quickLinks')}
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link to="/" className="text-white/75 hover:text-white transition-colors duration-150 flex items-center gap-1">
                  <span>{t('footer.linkHome')}</span>
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-white/75 hover:text-white transition-colors duration-150 flex items-center gap-1">
                  <span>{t('footer.linkAbout')}</span>
                </Link>
              </li>
              <li>
                <Link to="/features" className="text-white/75 hover:text-white transition-colors duration-150 flex items-center gap-1">
                  <span>{t('footer.linkFeatures')}</span>
                </Link>
              </li>
              <li>
                <Link to="/citizen" className="text-white/75 hover:text-white transition-colors duration-150 flex items-center gap-1">
                  <span>{t('footer.linkCitizen')}</span>
                </Link>
              </li>
              <li>
                <Link to="/citizen/get-assistance" className="text-white/75 hover:text-white transition-colors duration-150 flex items-center gap-1">
                  <span>{t('citizenNav.getAssistance')}</span>
                </Link>
              </li>
              <li>
                <Link to="/officer" className="text-white/75 hover:text-white transition-colors duration-150 flex items-center gap-1">
                  <span>{t('footer.linkOfficer')}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Governance & Support (Spans 2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--action-500)] font-heading">
              {t('footer.governance')}
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link to="/terms-of-use" className="text-white/75 hover:text-white transition-colors duration-150">
                  {t('footer.linkTerms')}
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="text-white/75 hover:text-white transition-colors duration-150">
                  {t('footer.linkPrivacy')}
                </Link>
              </li>
              <li>
                <Link to="/contact-us" className="text-white/75 hover:text-white transition-colors duration-150">
                  {t('footer.linkContact')}
                </Link>
              </li>
              <li>
                <a
                  href="https://svamitva.nic.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/75 hover:text-white transition-colors duration-150 inline-flex items-center gap-1"
                >
                  <span>SVAMITVA Portal</span>
                  <ArrowUpRight className="w-3 h-3 text-white/50" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: App Download & Social Media (Spans 3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white font-heading mb-2">
                {t('footer.getAppHeading')}
              </h4>
              {installed ? (
                <p className="text-[11px] text-emerald-300 font-semibold">
                  {t('footer.appInstalled')}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {/* Google Play badge -> triggers PWA install consent dialog */}
                    <button
                      type="button"
                      onClick={handleInstall}
                      className="bg-black/40 hover:bg-black/60 border border-white/20 px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer transition text-left"
                    >
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[9px]">
                        ▶
                      </div>
                      <div className="flex flex-col text-[9px] leading-tight">
                        <span className="text-white/60 text-[8px] uppercase">Get it on</span>
                        <span className="text-white font-bold text-[11px]">Google Play</span>
                      </div>
                    </button>

                    {/* App Store badge -> same install flow (iOS shows manual steps) */}
                    <button
                      type="button"
                      onClick={handleInstall}
                      className="bg-black/40 hover:bg-black/60 border border-white/20 px-3 py-1.5 rounded-md flex items-center gap-2 cursor-pointer transition text-left"
                    >
                      <div className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-[9px]">
                        🍎
                      </div>
                      <div className="flex flex-col text-[9px] leading-tight">
                        <span className="text-white/60 text-[8px] uppercase">Download on the</span>
                        <span className="text-white font-bold text-[11px]">App Store</span>
                      </div>
                    </button>
                  </div>
                  {showHint && (
                    <p className="mt-2 text-[10px] text-white/60 leading-snug max-w-[16rem]">
                      {isIOS ? t('footer.installHintIos') : t('footer.installHintGeneric')}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Social Icons */}
            <div>
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider block mb-2">
                {t('footer.joinUs')}
              </span>
              <div className="flex items-center gap-2 text-white/70">
                <a
                  href="https://youtu.be/l78Q6w6xgxI"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="p-1.5 rounded bg-white/5 hover:bg-white/15 hover:text-white transition"
                >
                  <Youtube className="w-4 h-4" />
                </a>
                <a href="#facebook" aria-label="Facebook" className="p-1.5 rounded bg-white/5 hover:bg-white/15 hover:text-white transition">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="#twitter" aria-label="Twitter" className="p-1.5 rounded bg-white/5 hover:bg-white/15 hover:text-white transition">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#instagram" aria-label="Instagram" className="p-1.5 rounded bg-white/5 hover:bg-white/15 hover:text-white transition">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="#linkedin" aria-label="LinkedIn" className="p-1.5 rounded bg-white/5 hover:bg-white/15 hover:text-white transition">
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Copyright & Footer Links Bar */}
      <div className="border-t border-white/10 bg-black/20 text-xs text-white/70 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <div>
            {t('footer.copyrightLine').replace(/\{\{year\}\}/g, String(currentYear))} Government of India
          </div>
          <div className="flex flex-wrap items-center gap-2 text-white/60">
            <Link to="/about" className="hover:text-white transition">{t('footer.bottomLinkSitemap')}</Link>
            <span>|</span>
            <Link to="/terms-of-use" className="hover:text-white transition">{t('footer.bottomLinkTerms')}</Link>
            <span>|</span>
            <Link to="/privacy-policy" className="hover:text-white transition">{t('footer.bottomLinkPrivacy')}</Link>
            <span>|</span>
            <Link to="/terms-of-use" className="hover:text-white transition">{t('footer.bottomLinkCopyright').replace(/\{\{year\}\}/g, String(currentYear))}</Link>
            <span>|</span>
            <Link to="/contact-us" className="hover:text-white transition">{t('footer.bottomLinkContact')}</Link>
            <span>|</span>
            <Link to="/contact-us" className="hover:text-white transition">{t('footer.bottomLinkNotifications')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
