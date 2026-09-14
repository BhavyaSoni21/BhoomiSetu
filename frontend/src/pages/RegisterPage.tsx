import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, Mail, Phone, UserPlus, AlertCircle, CheckCircle2, Globe } from 'lucide-react';
import { useTranslation, SupportedLanguage } from '../context/LanguageContext';
import { useRegister, useVerifyRegistrationOtp, useResendRegistrationOtp, ContactMethod } from '../features/auth/auth';
import OtpEntryForm from '../features/auth/OtpEntryForm';

const BsIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="7" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.22" />
    <rect x="8.5" y="3" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
  </svg>
);

const InputField: React.FC<{
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel';
}> = ({ id, label, type, value, onChange, placeholder, required, autoComplete, rightSlot, inputMode }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
      {label}{required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
    </label>
    <div className="relative">
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-150 pr-11"
        style={{
          background: 'var(--surface-1)',
          border: '1.5px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      />
      {rightSlot && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightSlot}</div>
      )}
    </div>
  </div>
);

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const verifyRegistrationOtpMutation = useVerifyRegistrationOtp();
  const resendRegistrationOtpMutation = useResendRegistrationOtp();
  const { t, currentLang, setLanguage } = useTranslation();

  const [step, setStep]                   = useState<'form' | 'otp'>('form');
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [method, setMethod]               = useState<ContactMethod>('EMAIL');
  const [name, setName]                   = useState('');
  const [email, setEmail]                 = useState('');
  const [mobileNumber, setMobileNumber]   = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const target = method === 'EMAIL' ? email : mobileNumber;

  const pwdStrength = (() => {
    if (password.length < 6) return 0;
    let s = 1;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (password !== confirmPassword) {
      setValidationError(t('authPage.passwordsNoMatchError'));
      return;
    }
    if (password.length < 8) {
      setValidationError(t('authPage.passwordTooShortError'));
      return;
    }
    try {
      const result = await registerMutation.mutateAsync({
        name,
        method,
        email: method === 'EMAIL' ? email : undefined,
        mobileNumber: method === 'MOBILE' ? mobileNumber : undefined,
        password,
        confirmPassword,
      });
      setRegistrationId(result.registrationId);
      setStep('otp');
    } catch { /* surfaced via registerMutation.isError */ }
  };

  const submitErrorMessage =
    registerMutation.isError
      ? (axios.isAxiosError(registerMutation.error) && registerMutation.error.response?.status === 409
          ? t(method === 'EMAIL' ? 'authPage.accountExistsEmailError' : 'authPage.accountExistsMobileError')
          : t('authPage.registrationFailedError'))
      : null;

  if (step === 'otp') {
    return (
      <div className="h-[calc(100vh-3.5rem)] overflow-y-auto flex items-center justify-center px-4" style={{ background: 'var(--page-bg)' }}>
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#D1FAE5' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: '#065F46' }} />
              </div>
            </div>
            <h2 className="font-heading font-bold text-2xl" style={{ color: 'var(--text-heading)' }}>
              {method === 'EMAIL' ? t('authPage.otpVerifyEmailHeading') : t('authPage.otpVerifyMobileHeading')}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('authPage.otpSentPrefix')}{' '}
              <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{target}</span>
            </p>
          </div>
          <OtpEntryForm
            method={method}
            target={target}
            onVerifyCode={(code) => verifyRegistrationOtpMutation.mutateAsync({ registrationId: registrationId!, code })}
            onResend={() => resendRegistrationOtpMutation.mutateAsync({ registrationId: registrationId! })}
            verifying={verifyRegistrationOtpMutation.isLoading}
            resending={resendRegistrationOtpMutation.isLoading}
            verifyError={verifyRegistrationOtpMutation.error}
            onVerified={() => navigate('/citizen')}
          />
          <button
            type="button"
            onClick={() => setStep('form')}
            className="w-full py-2.5 text-sm font-medium underline underline-offset-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('authPage.wrongContactGoBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden" style={{ background: 'var(--page-bg)' }}>
      {/* ── Left decorative column ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col w-[440px] shrink-0 p-12 relative overflow-hidden"
        style={{ background: 'var(--brand-900)' }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 440 800">
            {Array.from({ length: 5 }).map((_, row) =>
              Array.from({ length: 4 }).map((_, col) => (
                <rect key={`${row}-${col}`}
                  x={col * 110 + 8} y={row * 160 + 8}
                  width={96} height={146} rx="10"
                  fill="white" fillOpacity="0.07"
                  stroke="white" strokeOpacity="0.14" strokeWidth="1"
                />
              ))
            )}
          </svg>
        </div>
        <Link to="/" className="relative z-10 flex items-center gap-3.5">
          <span className="text-white/90"><BsIcon className="w-11 h-11" /></span>
          <span className="text-white font-heading font-bold text-5xl tracking-tight">BhoomiSetu</span>
        </Link>
        {/* Centre copy - a fixed gap below the logo (not stretched to fill
            the panel) so this whole block, bullets, and the govt strip all
            sit close together near the top with no leftover gap before the
            strip - keeps total column height compact enough to fit a real
            viewport without scrolling/clipping. */}
        <div className="relative z-10 mt-8 space-y-5">
          <h1 className="text-white font-heading font-bold text-3xl leading-snug">
            {t('authPage.registerHeroHeadline')}
          </h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-xs">
            {t('authPage.registerHeroBody')}
          </p>
          <div className="space-y-2.5 pt-1">
            {[t('authPage.registerBulletFree'), t('authPage.registerBulletVerify'), t('authPage.registerBulletTrack')].map((bullet) => (
              <div key={bullet} className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--brand-300)' }} />
                <span className="text-white/80 text-sm">{bullet}</span>
              </div>
            ))}
          </div>
          <p className="text-white/35 text-xs font-mono uppercase tracking-widest border-t border-white/15 pt-4">
            {t('authPage.govtStripRegister')}
          </p>
        </div>
      </div>

      {/* ── Right: Register form ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-4 sm:px-8 py-6 overflow-y-auto">
        {/* Top bar: mobile logo + language toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="lg:hidden flex items-center gap-2.5">
            <span style={{ color: 'var(--brand-900)' }}><BsIcon className="w-9 h-9" /></span>
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
        <div className="w-full max-w-[420px] space-y-5">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-3xl tracking-tight" style={{ color: 'var(--text-heading)' }}>
              {t('authPage.createAccountHeading')}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('authPage.alreadyRegisteredPrompt')}{' '}
              <Link to="/login" className="font-semibold underline underline-offset-2" style={{ color: 'var(--brand-700)' }}>
                {t('authPage.signInLink')}
              </Link>
            </p>
          </div>

          {/* Method toggle */}
          <div
            className="flex p-1 rounded-xl gap-1"
            role="tablist"
            aria-label={t('authPage.registerTabsAriaLabel')}
            style={{ background: 'var(--surface-2)' }}
          >
            {(['EMAIL', 'MOBILE'] as ContactMethod[]).map((m) => (
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
                } : { color: 'var(--text-muted)' }}
              >
                {m === 'EMAIL'
                  ? <><Mail className="w-3.5 h-3.5" aria-hidden="true" /> {t('authPage.emailTab')}</>
                  : <><Phone className="w-3.5 h-3.5" aria-hidden="true" /> {t('authPage.mobileTab')}</>
                }
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full name */}
            <InputField
              id="reg-name"
              label={t('authPage.fullNameLabel')}
              type="text"
              value={name}
              onChange={setName}
              placeholder="Anand Deshmukh"
              required
              autoComplete="name"
            />

            {/* Contact */}
            {method === 'EMAIL' ? (
              <InputField
                id="reg-email"
                label={t('authPage.emailAddressLabel')}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="reg-mobile" className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('authPage.mobileNumberLabel')} <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <div className="flex">
                  <span
                    className="flex items-center px-3.5 rounded-l-xl text-sm font-mono font-semibold"
                    style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    +91
                  </span>
                  <input
                    id="reg-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    pattern="[0-9]{10}"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 px-4 py-3 rounded-r-xl text-sm font-mono"
                    style={{ background: 'var(--surface-1)', border: '1.5px solid var(--border)', borderLeft: 'none', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('authPage.passwordLabel')} <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('authPage.minCharsPlaceholder')}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm"
                  style={{ background: 'var(--surface-1)', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? t('authPage.hidePassword') : t('authPage.showPassword')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ background: i <= pwdStrength
                        ? pwdStrength <= 2 ? '#EF4444' : pwdStrength <= 3 ? '#F59E0B' : '#16A34A'
                        : 'var(--border)' }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label htmlFor="reg-confirm" className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('authPage.confirmPasswordLabel')} <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm"
                  style={{ background: 'var(--surface-1)', border: '1.5px solid var(--border)', color: 'var(--text-primary)' }}
                />
                <button type="button" onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? t('authPage.hidePassword') : t('authPage.showPassword')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Errors */}
            {(validationError || submitErrorMessage) && (
              <div
                role="alert"
                className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {validationError || submitErrorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={registerMutation.isLoading}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-[4px] font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-50 cursor-pointer shadow-xs"
              style={{ background: '#208A43', color: '#FFFFFF' }}
            >
              {registerMutation.isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {t('authPage.creatingAccount')}
                </>
              ) : (
                <><UserPlus className="w-4 h-4" aria-hidden="true" /> {t('authPage.createAccountCta')}</>
              )}
            </button>
          </form>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {t('authPage.termsAgreementPrefix')}{' '}
            <Link to="/terms" className="underline underline-offset-2">{t('authPage.termsOfUse')}</Link>{' '}
            {t('authPage.andConnector')}{' '}
            <Link to="/privacy" className="underline underline-offset-2">{t('authPage.privacyPolicy')}</Link>.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
