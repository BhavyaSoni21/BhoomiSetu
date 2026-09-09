import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { ChevronDown, Eye, EyeOff, LogIn, Mail, Phone } from 'lucide-react';
import { useLogin } from '../features/auth/auth';
import { OFFICER_ROLES, ROLE_LABELS } from '../features/officer/officerAuth';

const DEMO_PASSWORD = 'Demo@123';
const DEMO_OFFICER_EMAILS: Record<(typeof OFFICER_ROLES)[number], string> = {
  LAND_RECORD_OFFICER: 'landrecords.officer@bhoomisetu.gov.in',
  REGISTRATION_OFFICER: 'registration.officer@bhoomisetu.gov.in',
  PLANNING_OFFICER: 'planning.officer@bhoomisetu.gov.in',
  DISPUTE_OFFICER: 'dispute.officer@bhoomisetu.gov.in',
  TAX_OFFICER: 'tax.officer@bhoomisetu.gov.in',
  RESTRICTION_OFFICER: 'restriction.officer@bhoomisetu.gov.in',
  ENCUMBRANCE_OFFICER: 'encumbrance.officer@bhoomisetu.gov.in',
};
const DEMO_ADMIN_EMAIL = 'admin@bhoomisetu.gov.in';

type LoginMethod = 'EMAIL' | 'MOBILE';

const toggleClass = (active: boolean) =>
  `flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wide border-2 border-ink transition ${
    active ? 'bg-primary text-white' : 'bg-surface text-ink/60 hover:text-ink'
  }`;

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [method, setMethod] = useState<LoginMethod>('EMAIL');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await loginMutation.mutateAsync(
        method === 'EMAIL' ? { email, password } : { mobileNumber, password },
      );
      navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'CITIZEN' ? '/citizen' : '/officer');
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 401
          ? t('auth.invalidCredentials')
          : t('auth.genericError'),
      );
    }
  };

  const fillDemo = (demoEmail: string) => {
    setMethod('EMAIL');
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6 sm:p-8">
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink" aria-hidden="true" />

          <h2 className="text-3xl font-black uppercase tracking-tight font-display text-ink">
            {t('auth.signInHeading')}
          </h2>
          <p className="text-sm text-ink/70 mt-2 leading-relaxed">{t('auth.signInSubtitle')}</p>

          {/* Method selector (docs/FRONTEND_UPGRADE_SPEC.md §3): a toggle,
              not both fields shown at once - only the relevant field appears
              below once a method is picked. */}
          <div className="flex gap-2 mt-6" role="tablist" aria-label={t('auth.methodSelectorLabel')}>
            <button type="button" role="tab" aria-selected={method === 'EMAIL'} onClick={() => setMethod('EMAIL')} className={toggleClass(method === 'EMAIL')}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                {t('auth.loginWithEmail')}
              </span>
            </button>
            <button type="button" role="tab" aria-selected={method === 'MOBILE'} onClick={() => setMethod('MOBILE')} className={toggleClass(method === 'MOBILE')}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                {t('auth.loginWithMobile')}
              </span>
            </button>
          </div>

          <form className="space-y-4 mt-5" onSubmit={handleSubmit}>
            {method === 'EMAIL' ? (
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                  {t('auth.emailLabel')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="loginMobileNumber" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                  {t('auth.mobileLabel')}
                </label>
                <input
                  id="loginMobileNumber"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  pattern="[0-9]{10}"
                  className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                  placeholder={t('auth.mobilePlaceholder')}
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 pr-11 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm font-medium text-secondary-strong">{error}</p>}

            <button
              type="submit"
              disabled={loginMutation.isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-secondary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              {loginMutation.isLoading ? t('auth.signingIn') : t('auth.signInButton')}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-ink/70">{t('auth.noAccountYet')}</span>
            <Link to="/register" className="font-bold text-primary hover:text-primary-strong underline underline-offset-2">
              {t('auth.registerLink')}
            </Link>
            <span className="text-ink/40">{t('auth.orGuest')}</span>
            <Link to="/" className="font-bold text-primary hover:text-primary-strong underline underline-offset-2">
              {t('auth.continueAsGuestLink')}
            </Link>
          </div>
        </div>

        {/* Shown in every environment, including a hosted demo build - judges/
            reviewers need a way to sign in without real credentials. */}
        <details className="bg-accent/15 border-2 border-ink text-ink">
          <summary className="flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer text-xs font-bold uppercase tracking-widest select-none">
            {t('auth.demoAccountsToggle')}
            <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
          </summary>
          <div className="px-4 pb-4 space-y-3 text-xs">
            <p className="font-semibold">
              {t('auth.demoAccountsPasswordNote')} <code className="font-mono">{DEMO_PASSWORD}</code>
            </p>

            <div>
              <p className="font-bold uppercase tracking-widest text-[10px] text-ink/60 mb-1">
                {t('auth.demoAccountsAdmin')}
              </p>
              <button
                type="button"
                onClick={() => fillDemo(DEMO_ADMIN_EMAIL)}
                className="block text-left w-full hover:text-primary hover:underline"
              >
                {DEMO_ADMIN_EMAIL} — Admin
              </button>
            </div>

            <div>
              <p className="font-bold uppercase tracking-widest text-[10px] text-ink/60 mb-1">
                {t('auth.demoAccountsOfficers')}
              </p>
              <ul className="space-y-0.5">
                {OFFICER_ROLES.map((role) => (
                  <li key={role}>
                    <button
                      type="button"
                      onClick={() => fillDemo(DEMO_OFFICER_EMAILS[role])}
                      className="block text-left w-full hover:text-primary hover:underline"
                    >
                      {DEMO_OFFICER_EMAILS[role]} — {ROLE_LABELS[role]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-bold uppercase tracking-widest text-[10px] text-ink/60 mb-1">
                {t('auth.demoAccountsCitizens')}
              </p>
              <button
                type="button"
                onClick={() => fillDemo('citizen1@example.com')}
                className="block text-left w-full hover:text-primary hover:underline"
              >
                {t('auth.demoAccountsCitizensNote')}
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default LoginPage;
