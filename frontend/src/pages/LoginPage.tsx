import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail, Phone, ChevronDown, ShieldCheck, AlertCircle, Globe } from 'lucide-react';
import { useTranslation, SupportedLanguage } from '../context/LanguageContext';
import { useLogin } from '../features/auth/auth';
import { OFFICER_ROLES, ROLE_LABELS } from '../features/officer/officerAuth';
import axios from 'axios';

const DEMO_PASSWORD = 'Demo@123';
const DEMO_OFFICER_EMAILS: Record<(typeof OFFICER_ROLES)[number], string> = {
  LAND_RECORD_OFFICER:   'landrecords.officer@bhoomisetu.gov.in',
  REGISTRATION_OFFICER:  'registration.officer@bhoomisetu.gov.in',
  PLANNING_OFFICER:      'planning.officer@bhoomisetu.gov.in',
  DISPUTE_OFFICER:       'dispute.officer@bhoomisetu.gov.in',
  TAX_OFFICER:           'tax.officer@bhoomisetu.gov.in',
  RESTRICTION_OFFICER:   'restriction.officer@bhoomisetu.gov.in',
  ENCUMBRANCE_OFFICER:   'encumbrance.officer@bhoomisetu.gov.in',
};
const DEMO_ADMIN_EMAIL = 'admin@bhoomisetu.gov.in';

type LoginMethod = 'EMAIL' | 'MOBILE';

/* SVG nested-squares logo (same as navbar) */
const BsIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="7" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.22" />
    <rect x="8.5" y="3" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
  </svg>
);

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const { t, currentLang, setLanguage } = useTranslation();

  const [method, setMethod]             = useState<LoginMethod>('EMAIL');
  const [email, setEmail]               = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword]         = useState('');
  const [showPwd, setShowPwd]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [demoOpen, setDemoOpen]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await loginMutation.mutateAsync(
        method === 'EMAIL' ? { email, password } : { mobileNumber, password },
      );
      const dest =
        user.role === 'ADMIN'   ? '/admin'   :
        user.role === 'CITIZEN' ? '/citizen' : '/officer';
      navigate(dest);
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 401
          ? t('authPage.invalidCredentialsError')
          : t('authPage.genericError'),
      );
    }
  };

  const fillDemo = (demoEmail: string) => {
    setMethod('EMAIL');
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setDemoOpen(false);
    setError(null);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden" style={{ background: 'var(--page-bg)' }}>
      {/* ── Left decorative column (desktop only) ─────────────────────────── */}
      <div
        className="hidden lg:flex flex-col w-[480px] shrink-0 relative overflow-hidden p-12"
        style={{ background: 'var(--brand-900)' }}
        aria-hidden="true"
      >
        {/* Background parcel grid SVG */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 480 800" fill="none">
            {Array.from({ length: 6 }).map((_, row) =>
              Array.from({ length: 5 }).map((_, col) => (
                <rect
                  key={`${row}-${col}`}
                  x={col * 96 + 4} y={row * 136 + 4}
                  width={88} height={128} rx="8"
                  fill="white" fillOpacity="0.06"
                  stroke="white" strokeOpacity="0.12" strokeWidth="1"
                />
              ))
            )}
            {/* Selected parcel highlight */}
            <rect x="196" y="276" width="88" height="128" rx="8"
              fill="#F59E0B" fillOpacity="0.3"
              stroke="#F59E0B" strokeOpacity="0.8" strokeWidth="2"
              strokeDasharray="4 3" />
            <circle cx="240" cy="340" r="10" fill="#F59E0B" fillOpacity="0.9" />
            <path d="M240 356 L233 344 L247 344 Z" fill="#F59E0B" fillOpacity="0.9" />
          </svg>
        </div>

        {/* Top brand */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="text-white/90 group-hover:text-white transition-colors">
              <BsIcon className="w-11 h-11" />
            </div>
            <span className="text-white font-heading font-bold text-5xl tracking-tight">
              BhoomiSetu
            </span>
          </Link>
        </div>

        {/* Centre copy - a fixed gap below the logo (not stretched to fill
            the panel) so this whole block, trust indicators, and the govt
            strip all sit close together near the top with no leftover gap
            before the strip - the entire column's content stays compact
            enough to fit a real viewport height without scrolling/clipping. */}
        <div className="relative z-10 mt-10 space-y-6">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-widest"
            style={{ background: 'rgba(var(--action-500), 0.18)', color: 'var(--action-700)', border: '1px solid rgba(var(--action-500), 0.3)' }}
          >
            {t('authPage.gisLandGovernanceBadge')}
          </div>

          <h1 className="text-white font-heading font-bold text-4xl leading-tight">
            {t('authPage.loginHeroHeadline1')}
            <br />
            {t('authPage.loginHeroHeadline2')}
          </h1>
          <p className="text-white/70 text-base leading-relaxed max-w-xs">
            {t('authPage.loginHeroBody')}
          </p>

          {/* Trust indicators */}
          <div className="flex flex-col gap-3 pt-2">
            {[
              t('authPage.trustParcelsMapped'),
              t('authPage.trustDeptFeeds'),
              t('authPage.trustSvamitva'),
            ].map((label) => (
              <div key={label} className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: 'var(--brand-300)' }} />
                <span className="text-white/80 text-sm">{label}</span>
              </div>
            ))}
          </div>

          {/* Bottom govt strip */}
          <div className="border-t border-white/15 pt-4">
            <p className="text-white/40 text-xs font-mono uppercase tracking-widest">
              {t('authPage.govtStripLogin')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: Login form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-4 sm:px-8 py-6 overflow-y-auto">
        {/* Top bar: mobile logo + language toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="lg:hidden flex items-center gap-2.5">
            <div style={{ color: 'var(--brand-900)' }}><BsIcon className="w-9 h-9" /></div>
            <span className="font-heading font-bold text-4xl" style={{ color: 'var(--brand-900)' }}>BhoomiSetu</span>
          </div>
          <div className="lg:block hidden" />{/* spacer on desktop */}
          {/* Language toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <Globe className="w-4 h-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <select
              aria-label={t('nav.languageSelectLabel')}
              value={currentLang}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border cursor-pointer focus:outline-none focus:ring-2 transition"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="or">ଓଡ଼ିଆ (Odia)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
            </select>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Heading */}
          <div className="space-y-1.5">
            <h2
              className="font-heading font-bold text-3xl tracking-tight"
              style={{ color: 'var(--text-heading)' }}
            >
              {t('authPage.signInHeading')}
            </h2>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
              {t('authPage.signInSubtitle')}
            </p>
          </div>

          {/* Method toggle */}
          <div
            className="flex p-1 rounded-xl gap-1"
            role="tablist"
            aria-label={t('authPage.loginTabsAriaLabel')}
            style={{ background: 'var(--surface-2)' }}
          >
            {(['EMAIL', 'MOBILE'] as LoginMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => setMethod(m)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                style={method === m ? {
                  background: 'var(--surface-1)',
                  color: 'var(--text-heading)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                } : {
                  color: 'var(--text-muted)',
                }}
              >
                {m === 'EMAIL'
                  ? <><Mail className="w-3.5 h-3.5" aria-hidden="true" /> {t('authPage.emailTab')}</>
                  : <><Phone className="w-3.5 h-3.5" aria-hidden="true" /> {t('authPage.mobileTab')}</>
                }
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Identifier field */}
            <div className="space-y-1.5">
              <label
                htmlFor={method === 'EMAIL' ? 'login-email' : 'login-mobile'}
                className="block text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {method === 'EMAIL' ? t('authPage.emailAddressLabel') : t('authPage.mobileNumberLabel')}
              </label>
              {method === 'EMAIL' ? (
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@bhoomisetu.gov.in"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-150"
                  style={{
                    background: 'var(--surface-1)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              ) : (
                <div className="flex">
                  <span
                    className="flex items-center px-3.5 rounded-l-xl text-sm font-mono font-semibold border-r-0"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1.5px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    +91
                  </span>
                  <input
                    id="login-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    pattern="[0-9]{10}"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 px-4 py-3 rounded-r-xl text-sm font-mono transition-all duration-150"
                    style={{
                      background: 'var(--surface-1)',
                      border: '1.5px solid var(--border)',
                      borderLeft: 'none',
                      color: 'var(--text-primary)',
                    }}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </div>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('authPage.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm transition-all duration-150"
                  style={{
                    background: 'var(--surface-1)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? t('authPage.hidePassword') : t('authPage.showPassword')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPwd
                    ? <EyeOff className="w-4 h-4" aria-hidden="true" />
                    : <Eye className="w-4 h-4" aria-hidden="true" />
                  }
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                id="login-error"
                role="alert"
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isLoading}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-[4px] font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              style={{
                background: '#208A43',
                color: '#FFFFFF',
              }}
            >
              {loginMutation.isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {t('authPage.signingIn')}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  {t('authPage.signInCta')}
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            {t('authPage.newCitizenPrompt')}{' '}
            <Link
              to="/register"
              className="font-semibold underline underline-offset-2 transition-colors"
              style={{ color: 'var(--brand-700)' }}
            >
              {t('authPage.createAccountLink')}
            </Link>
            {'  ·  '}
            <Link
              to="/"
              className="font-semibold underline underline-offset-2 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('authPage.continueAsGuestLink')}
            </Link>
          </p>

          {/* Demo accounts panel */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setDemoOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
              }}
              aria-expanded={demoOpen}
            >
              {t('authPage.demoAccountsToggle')}
              <ChevronDown
                className="w-4 h-4 transition-transform duration-200"
                style={{ transform: demoOpen ? 'rotate(180deg)' : 'none' }}
                aria-hidden="true"
              />
            </button>

            {demoOpen && (
              <div className="p-4 space-y-4" style={{ background: 'var(--surface-1)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('authPage.demoSharedPassword')}{' '}
                  <code
                    className="font-mono px-1.5 py-0.5 rounded text-xs"
                    style={{ background: 'var(--surface-2)', color: 'var(--brand-900)' }}
                  >
                    {DEMO_PASSWORD}
                  </code>
                </p>

                {/* Admin */}
                <div className="space-y-1.5">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('authPage.demoAdminLabel')}
                  </p>
                  <button
                    type="button"
                    onClick={() => fillDemo(DEMO_ADMIN_EMAIL)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg font-mono transition-colors"
                    style={{ color: 'var(--text-primary)', background: 'var(--surface-2)' }}
                  >
                    {DEMO_ADMIN_EMAIL}
                  </button>
                </div>

                {/* Officers */}
                <div className="space-y-1.5">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('authPage.demoOfficersLabel')}
                  </p>
                  <div className="space-y-1">
                    {OFFICER_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => fillDemo(DEMO_OFFICER_EMAILS[role])}
                        className="flex w-full items-center justify-between text-left text-xs px-3 py-2 rounded-lg font-mono transition-colors hover:opacity-80"
                        style={{ color: 'var(--text-primary)', background: 'var(--surface-2)' }}
                      >
                        <span className="truncate">{DEMO_OFFICER_EMAILS[role]}</span>
                        <span
                          className="ml-2 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold"
                          style={{ background: '#D1FAE5', color: '#065F46' }}
                        >
                          {ROLE_LABELS[role]?.replace(/ Officer$/, '')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Citizen */}
                <div className="space-y-1.5">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('authPage.demoCitizenLabel')}
                  </p>
                  <button
                    type="button"
                    onClick={() => fillDemo('citizen1@example.com')}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg font-mono transition-colors"
                    style={{ color: 'var(--text-primary)', background: 'var(--surface-2)' }}
                  >
                    citizen1@example.com
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
