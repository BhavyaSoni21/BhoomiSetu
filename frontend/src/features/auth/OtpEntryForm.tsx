import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { CheckCircle2, RotateCw } from 'lucide-react';
import { useVerifyOtp, useResendOtp, AuthUser, ContactMethod } from './auth';

const OTP_EXPIRY_SECONDS = 10 * 60; // matches EMAIL_OTP_EXPIRY_MINUTES on the backend; used client-side for both channels for a consistent countdown
const RESEND_COOLDOWN_SECONDS = 30; // matches EMAIL_OTP_RESEND_COOLDOWN_SECONDS; Fast2SMS enforces its own for mobile, this is just the UI's best-effort mirror

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface OtpEntryFormProps {
  method: ContactMethod;
  target: string;
  onVerified: (user: AuthUser) => void;
  onCancel?: () => void;
}

// 6-digit code entry, visible expiry countdown, rate-limited resend, clear
// invalid-code error (docs/FRONTEND_UPGRADE_SPEC.md §3 - "OTP should
// look/behave identically for mobile and email for UI consistency"). Shared
// by the post-registration verification step (RegisterPage.tsx) and
// Profile's add/change-contact flow (ProfilePage.tsx) - both just need
// "verify this code for this method" and an updated user back.
const OtpEntryForm: React.FC<OtpEntryFormProps> = ({ method, target, onVerified, onCancel }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resent, setResent] = useState(false);
  const verifyMutation = useVerifyOtp();
  const resendMutation = useResendOtp();

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyMutation.mutate(
      { method, code },
      { onSuccess: (user) => onVerified(user) },
    );
  };

  const handleResend = () => {
    resendMutation.mutate(
      { method },
      {
        onSuccess: () => {
          setSecondsLeft(OTP_EXPIRY_SECONDS);
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
          setResent(true);
        },
      },
    );
  };

  const verifyErrorMessage =
    verifyMutation.isError &&
    (axios.isAxiosError(verifyMutation.error) && verifyMutation.error.response?.status === 403
      ? t('auth.otpLockedOut')
      : t('auth.otpInvalid'));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-ink/80">{t('auth.otpSentTo', { target })}</p>

      <div>
        <label htmlFor="otpCode" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
          {t('auth.otpCodeLabel')}
        </label>
        <input
          id="otpCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink text-center text-2xl tracking-[0.5em] placeholder:text-ink/30 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-primary"
          placeholder={t('auth.otpCodePlaceholder')}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>

      {verifyErrorMessage && <p className="text-sm font-medium text-secondary-strong">{verifyErrorMessage}</p>}
      {resent && !verifyMutation.isError && <p className="text-sm font-medium text-primary">{t('auth.otpResendSuccess')}</p>}

      <p className="text-xs text-ink/60">
        {secondsLeft > 0 ? t('auth.otpExpiresIn', { time: formatTime(secondsLeft) }) : t('auth.otpExpired')}
      </p>

      <button
        type="submit"
        disabled={verifyMutation.isLoading || code.length < 4}
        className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-secondary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
        {verifyMutation.isLoading ? t('auth.otpVerifying') : t('auth.otpVerifyButton')}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0 || resendMutation.isLoading}
          className="inline-flex items-center gap-1.5 font-bold text-primary hover:text-primary-strong disabled:text-ink/40 disabled:cursor-not-allowed"
        >
          <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
          {resendCooldown > 0 ? t('auth.otpResendCooldown', { seconds: resendCooldown }) : t('auth.otpResendButton')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-ink/60 hover:text-ink underline underline-offset-2">
            {t('auth.otpSkipForNow')}
          </button>
        )}
      </div>
    </form>
  );
};

export default OtpEntryForm;
