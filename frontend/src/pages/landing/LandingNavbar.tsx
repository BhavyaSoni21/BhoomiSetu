import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Menu, X } from 'lucide-react';
import { LandingContent, LandingLanguage } from './content';

interface LandingNavbarProps {
  t: LandingContent;
  isGuest: boolean;
  isScrolled: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  language: LandingLanguage;
  changeLanguage: (next: LandingLanguage) => void;
  theme: string;
  toggleTheme: () => void;
  setIsSearchModalOpen: (open: boolean) => void;
}

// KNOWN_RISKS.md LOW-3: split out of the 951-line BhoomiSetuLanding.tsx -
// this is section 1 (FLOATING GLASSMORPHISM NAVBAR), unchanged markup.
const LandingNavbar: React.FC<LandingNavbarProps> = ({
  t,
  isGuest,
  isScrolled,
  mobileMenuOpen,
  setMobileMenuOpen,
  language,
  changeLanguage,
  theme,
  toggleTheme,
  setIsSearchModalOpen,
}) => {
  const navigate = useNavigate();

  if (!isGuest) return null;

  return (
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
          {/* Browser-history back - phone view, inside the mobile menu
              itself rather than the cramped header bar. */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate(-1);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 font-medium text-sm w-full text-left"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back
          </button>
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
  );
};

export default LandingNavbar;
