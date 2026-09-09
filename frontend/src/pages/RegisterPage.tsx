import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Eye, EyeOff, Mail, Phone, UserPlus } from 'lucide-react';
import { useRegister, ContactMethod } from '../features/auth/auth';
import OtpEntryForm from '../features/auth/OtpEntryForm';

const toggleClass = (active: boolean) =>
  `flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wide border-2 border-ink transition ${
    active ? 'bg-primary text-white' : 'bg-surface text-ink/60 hover:text-ink'
  }`;

// Citizen self-registration (docs/FRONTEND_UPGRADE_SPEC.md §3) - a real form
// now (POST /auth/register exists), replacing the earlier disabled-submit
// placeholder. A method-selector, not both fields at once, and registration
// itself returns a session immediately (see AuthService.register on the
// backend) - the OTP step right after is verification of the chosen
// contact method, not a login gate, and can be deferred ("Skip for now").
const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registerMutation = useRegister();

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [method, setMethod] = useState<ContactMethod>('EMAIL');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const target = method === 'EMAIL' ? email : mobileNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (password !== confirmPassword) {
      setValidationError(t('auth.passwordMismatch'));
      return;
    }
    try {
      await registerMutation.mutateAsync({
        name,
        method,
        email: method === 'EMAIL' ? email : undefined,
        mobileNumber: method === 'MOBILE' ? mobileNumber : undefined,
        password,
        confirmPassword,
      });
      setStep('otp');
    } catch {
      // Surfaced below via registerMutation.isError.
    }
  };

  const submitErrorMessage =
    registerMutation.isError &&
    (axios.isAxiosError(registerMutation.error) && registerMutation.error.response?.data?.message
      ? String(registerMutation.error.response.data.message)
      : t('auth.registerGenericError'));

  if (step === 'otp') {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6 sm:p-8">
            <span className="absolute -top-3 -right-3 w-6 h-6 bg-accent border-2 border-ink" aria-hidden="true" />
            <h2 className="text-3xl font-black uppercase tracking-tight font-display text-ink mb-1">
              {t('auth.otpHeading', { method: method === 'EMAIL' ? t('auth.methodEmail') : t('auth.methodMobile') })}
            </h2>
            <p className="text-sm text-ink/70 mb-5">{t('auth.otpVerifiedSuccessDesc', { method: method === 'EMAIL' ? t('auth.methodEmail') : t('auth.methodMobile') })}</p>
            <OtpEntryForm method={method} target={target} onVerified={() => navigate('/citizen')} onCancel={() => navigate('/citizen')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6 sm:p-8">
          <span className="absolute -top-3 -right-3 w-6 h-6 bg-accent border-2 border-ink" aria-hidden="true" />

          <h2 className="text-3xl font-black uppercase tracking-tight font-display text-ink">
            {t('auth.registerHeading')}
          </h2>

          {/* Method selector (docs/FRONTEND_UPGRADE_SPEC.md §3) */}
          <div className="flex gap-2 mt-6" role="tablist" aria-label={t('auth.methodSelectorLabel')}>
            <button type="button" role="tab" aria-selected={method === 'EMAIL'} onClick={() => setMethod('EMAIL')} className={toggleClass(method === 'EMAIL')}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                {t('auth.registerWithEmail')}
              </span>
            </button>
            <button type="button" role="tab" aria-selected={method === 'MOBILE'} onClick={() => setMethod('MOBILE')} className={toggleClass(method === 'MOBILE')}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                {t('auth.registerWithMobile')}
              </span>
            </button>
          </div>

          <form className="space-y-4 mt-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.nameLabel')}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {method === 'EMAIL' ? (
              <div>
                <label htmlFor="registerEmail" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                  {t('auth.emailLabel')}
                </label>
                <input
                  id="registerEmail"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="registerMobileNumber" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                  {t('auth.mobileLabel')}
                </label>
                <input
                  id="registerMobileNumber"
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
              <label htmlFor="registerPassword" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="registerPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 pr-11 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {t('auth.confirmPasswordLabel')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 pr-11 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {(validationError || submitErrorMessage) && (
              <p className="text-sm font-medium text-secondary-strong">{validationError || submitErrorMessage}</p>
            )}

            <button
              type="submit"
              disabled={registerMutation.isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-secondary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {registerMutation.isLoading ? t('auth.registering') : t('auth.registerButton')}
            </button>
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
