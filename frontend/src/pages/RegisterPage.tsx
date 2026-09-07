import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, UserPlus } from 'lucide-react';

// [Placeholder] per docs/flow.md §4 - self-service registration doesn't
// exist on the backend yet (no POST /auth/register). This page is the
// target design for when it's built: the form is fully drawn and usable to
// type into, but submission is disabled with a clear "not open yet" notice
// rather than silently doing nothing or faking success.
const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6 sm:p-8">
          <span className="absolute -top-3 -right-3 w-6 h-6 bg-accent border-2 border-ink" aria-hidden="true" />

          <h2 className="text-3xl font-black uppercase tracking-tight font-display text-ink">
            {t('auth.registerHeading')}
          </h2>

          <div className="mt-4 flex gap-3 border-2 border-ink bg-accent/20 px-4 py-3 text-sm">
            <Clock className="w-5 h-5 shrink-0 text-secondary-strong mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold uppercase tracking-wide text-xs text-ink">
                {t('auth.registerComingSoonTitle')}
              </p>
              <p className="text-ink/80 mt-1 leading-relaxed">{t('auth.registerComingSoon')}</p>
            </div>
          </div>

          <form
            className="space-y-4 mt-6"
            onSubmit={(e) => e.preventDefault()}
            aria-describedby="register-disabled-note"
          >
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.nameLabel')}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="registerEmail" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.emailLabel')}
              </label>
              <input
                id="registerEmail"
                type="email"
                autoComplete="email"
                className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="registerPassword" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.passwordLabel')}
              </label>
              <input
                id="registerPassword"
                type="password"
                autoComplete="new-password"
                className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.confirmPasswordLabel')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled
              title={t('auth.registerComingSoon')}
              className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-secondary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm opacity-50 cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {t('auth.registerButton')}
            </button>
            <p id="register-disabled-note" className="sr-only">
              {t('auth.registerComingSoon')}
            </p>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-ink/70">{t('auth.backToLogin')}</span>
            <Link to="/login" className="font-bold text-primary hover:text-primary-strong underline underline-offset-2">
              {t('auth.backToLoginLink')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
