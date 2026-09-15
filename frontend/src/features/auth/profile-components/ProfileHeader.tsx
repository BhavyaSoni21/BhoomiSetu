import React from 'react';
import { ArrowLeft, Phone, Globe, ShieldCheck, RotateCw } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation, SupportedLanguage } from '../../../context/LanguageContext';
import SvgIndianEmblem from '../../../components/IndianEmblem';

interface ProfileHeaderProps {
  title?: string;
  subtitle?: string;
  lastUpdated?: string;
  onEditClick?: () => void;
  showFullNavigation?: boolean;
  onRefreshClick?: () => void;
  isRefreshing?: boolean;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  title = 'My Profile',
  subtitle = 'Manage your identity, land records, documents, and communication preferences.',
  lastUpdated = '11 Sep 2026, 10:24 AM',
  onEditClick,
  showFullNavigation = false,
  onRefreshClick,
  isRefreshing = false,
}) => {
  const navigate = useNavigate();
  const { t, currentLang, setLanguage, loading: langLoading } = useTranslation();

  return (
    <div className="w-full space-y-4 mb-6">
      {/* ── Top Brand Strip (if full navigation requested) ── */}
      {showFullNavigation && (
        <div className="utility-bar bg-[#0F3D2E] text-white/90 text-xs py-2 px-4 sm:px-6 lg:px-8 border-b border-white/15">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* Left: Emblem & Title */}
            <div className="flex items-center gap-3">
              <SvgIndianEmblem width="22" height="30" className="text-white brightness-200" />
              <div className="flex flex-col">
                <span className="font-heading font-bold text-white tracking-wide text-[11px] uppercase">
                  Government of India · State Land Records
                </span>
                <span className="text-emerald-300 text-[10px] font-mono">
                  SVAMITVA Scheme Integrated
                </span>
              </div>
            </div>

            {/* Right: Helpline & Language Switcher */}
            <div className="flex items-center gap-4 text-xs">
              <span className="hidden sm:flex items-center gap-1.5 text-white/90">
                <Phone className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>Toll-Free Helpline: <strong className="text-white">1800-11-2026</strong></span>
              </span>

              <span className="text-white/20 hidden sm:inline">|</span>

              {/* Bhashini Language Switcher */}
              <div className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 px-2.5 py-1 rounded-lg transition border border-white/10">
                <Globe className={`w-3.5 h-3.5 text-amber-400 ${langLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                <select
                  aria-label="Select Language"
                  value={currentLang}
                  onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                  className="bg-transparent text-white cursor-pointer focus:outline-none text-xs font-semibold pr-1"
                >
                  <option value="en" className="bg-[#0F3D2E] text-white">English</option>
                  <option value="mr" className="bg-[#0F3D2E] text-white">मराठी (Marathi)</option>
                  <option value="hi" className="bg-[#0F3D2E] text-white">हिंदी (Hindi)</option>
                  <option value="bn" className="bg-[#0F3D2E] text-white">বাংলা (Bengali)</option>
                  <option value="gu" className="bg-[#0F3D2E] text-white">ગુજરાતી (Gujarati)</option>
                  <option value="kn" className="bg-[#0F3D2E] text-white">ಕನ್ನಡ (Kannada)</option>
                  <option value="ml" className="bg-[#0F3D2E] text-white">മലയാളം (Malayalam)</option>
                  <option value="or" className="bg-[#0F3D2E] text-white">ଓଡ଼ିଆ (Odia)</option>
                  <option value="pa" className="bg-[#0F3D2E] text-white">ਪੰਜਾਬੀ (Punjabi)</option>
                  <option value="ta" className="bg-[#0F3D2E] text-white">தமிழ் (Tamil)</option>
                  <option value="te" className="bg-[#0F3D2E] text-white">తెలుగు (Telugu)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Title Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-emerald-700 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>BACK</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-text-heading">
            {title}
          </h1>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            {subtitle}
          </p>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
          <span className="text-xs font-mono text-text-muted">
            Last updated: {lastUpdated}
          </span>
          {onRefreshClick && (
            <button
              type="button"
              onClick={onRefreshClick}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-white dark:bg-surface-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-2xs transition disabled:opacity-50"
              title="Sync with database"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isRefreshing ? 'Syncing...' : 'Sync with DB'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
