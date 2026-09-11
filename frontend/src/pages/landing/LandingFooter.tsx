import React from 'react';
import { Link } from 'react-router-dom';
import { LandingContent } from './content';

interface LandingFooterProps {
  t: LandingContent;
  setIsSearchModalOpen: (open: boolean) => void;
}

// KNOWN_RISKS.md LOW-3 split - section 9 (FOOTER, deep forest green #0F3D2E), unchanged markup.
const LandingFooter: React.FC<LandingFooterProps> = ({ t, setIsSearchModalOpen }) => (
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
);

export default LandingFooter;
