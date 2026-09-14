import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import axios from 'axios';
import { CheckCircle2, Mail, Phone } from 'lucide-react';
import { useUpdateContact, useVerifyOtp, useResendOtp, AuthUser, ContactMethod } from './auth';
import OtpEntryForm from './OtpEntryForm';

type Mode = 'view' | 'edit' | 'otp';

export interface ContactMethodCardProps {
  method: ContactMethod;
  user: AuthUser;
}

// Add: enter the missing method -> verify -> added. Change: enter new value
// -> verify new value -> only then does it replace the old one
// (docs/FRONTEND_UPGRADE_SPEC.md §3) - the backend already enforces this
// (AuthService.addOrChangeContact stages a change into
// pendingEmail/pendingMobileNumber rather than overwriting immediately);
// this component just walks the signed-in user through whichever step their
// current state calls for. Originally Citizen Profile-only (ProfilePage.tsx);
// extracted 2026-09-10 so Officer Profile (OfficerProfilePage.tsx) can reuse
// it verbatim - POST /auth/profile/contact and /auth/verify-otp are role-
// agnostic on the backend (AuthService's methods operate on any User row),
// only the controller's @Roles guard needed widening past CITIZEN_ROLE.
const ContactMethodCard: React.FC<ContactMethodCardProps> = ({ method, user }) => {
  const { t } = useTranslation();
  const updateContactMutation = useUpdateContact();
  const verifyOtpMutation = useVerifyOtp();
  const resendOtpMutation = useResendOtp();
  const [mode, setMode] = useState<Mode>('view');
  const [inputValue, setInputValue] = useState('');
  const [otpTarget, setOtpTarget] = useState('');

  const Icon = method === 'EMAIL' ? Mail : Phone;
  const label = method === 'EMAIL' ? t('citizenPortal.profileEmailLabel') : t('citizenPortal.profileMobileLabel');
  const currentValue = method === 'EMAIL' ? user.email : user.mobileNumber;
  const verified = method === 'EMAIL' ? user.emailVerified : user.mobileVerified;
  const pendingValue = method === 'EMAIL' ? user.pendingEmail : user.pendingMobileNumber;

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateContactMutation.mutate(
      { method, email: method === 'EMAIL' ? inputValue : undefined, mobileNumber: method === 'MOBILE' ? inputValue : undefined },
      {
        onSuccess: () => {
          setOtpTarget(inputValue);
          setMode('otp');
        },
      },
    );
  };

  const errorMessage =
    updateContactMutation.isError &&
    (axios.isAxiosError(updateContactMutation.error) && updateContactMutation.error.response?.data?.message
      ? String(updateContactMutation.error.response.data.message)
      : t('citizenPortal.profileContactUpdateError'));

  if (mode === 'otp') {
    return (
      <div className="border-2 border-ink/20 p-4">
        <h3 className="font-bold text-ink flex items-center gap-1.5 mb-3">
          <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          {label}
        </h3>
        <OtpEntryForm
          method={method}
          target={otpTarget}
          onVerifyCode={(code) => verifyOtpMutation.mutateAsync({ method, code })}
          onResend={() => resendOtpMutation.mutateAsync({ method })}
          verifying={verifyOtpMutation.isLoading}
          resending={resendOtpMutation.isLoading}
          verifyError={verifyOtpMutation.error}
          onVerified={() => setMode('view')}
          onCancel={() => setMode('view')}
        />
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div className="border-2 border-ink/20 p-4">
        <h3 className="font-bold text-ink flex items-center gap-1.5 mb-3">
          <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          {label}
        </h3>
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <input
            type={method === 'EMAIL' ? 'email' : 'tel'}
            inputMode={method === 'MOBILE' ? 'numeric' : undefined}
            required
            pattern={method === 'MOBILE' ? '[0-9]{10}' : undefined}
            placeholder={method === 'EMAIL' ? t('auth.emailPlaceholder') : t('auth.mobilePlaceholder')}
            className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
            value={inputValue}
            onChange={(e) => setInputValue(method === 'MOBILE' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value)}
          />
          {errorMessage && <p className="text-sm font-medium text-secondary-strong">{errorMessage}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateContactMutation.isLoading}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {updateContactMutation.isLoading ? t('auth.otpVerifying') : t('citizenPortal.profileSendCodeCta')}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="px-4 py-2 border-2 border-ink text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
            >
              {t('citizenPortal.profileCancelCta')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="border-2 border-ink/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink flex items-center gap-1.5">
            <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            {label}
          </h3>
          {currentValue ? (
            <>
              <p className="text-ink/80 mt-1">{currentValue}</p>
              <span
                className={`inline-flex items-center gap-1 mt-1.5 border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  verified ? 'bg-primary/15 text-primary border-primary/50' : 'bg-accent/20 text-secondary-strong border-accent/50'
                }`}
              >
                {verified && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                {verified ? t('citizenPortal.profileVerifiedBadge') : t('citizenPortal.profileUnverifiedBadge')}
              </span>
              {pendingValue && (
                <p className="text-xs text-secondary-strong mt-1.5">{t('citizenPortal.profilePendingNote', { value: pendingValue })}</p>
              )}
            </>
          ) : (
            <p className="text-ink/50 mt-1 text-sm">{t('citizenPortal.profileNotProvided')}</p>
          )}
        </div>

        {pendingValue || (currentValue && !verified) ? (
          <button
            type="button"
            onClick={() => {
              setOtpTarget(pendingValue ?? currentValue ?? '');
              setMode('otp');
            }}
            className="shrink-0 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
          >
            {t('citizenPortal.profileVerifyCta')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setMode('edit');
            }}
            className="shrink-0 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
          >
            {currentValue ? t('citizenPortal.profileChangeCta') : t('citizenPortal.profileAddCta')}
          </button>
        )}
      </div>
    </div>
  );
};

export default ContactMethodCard;
