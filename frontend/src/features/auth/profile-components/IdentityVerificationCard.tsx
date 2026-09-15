import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Smartphone, History, Pencil, Plus } from 'lucide-react';
import { AuthUser } from '../auth';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';

interface IdentityVerificationCardProps {
  user?: AuthUser;
  mode?: 'citizen' | 'officer' | 'admin';
  onChangeEmail?: () => void;
  onChangeMobile?: () => void;
  onUpdateDetails?: () => void;
  onViewHistory?: () => void;
}

export const IdentityVerificationCard: React.FC<IdentityVerificationCardProps> = ({
  user,
  mode = 'citizen',
  onChangeEmail,
  onChangeMobile,
  onUpdateDetails,
  onViewHistory,
}) => {
  const isCitizen = mode === 'citizen';
  const isOfficer = mode === 'officer';
  const isAdmin = mode === 'admin';

  const defaultGovtId = isCitizen ? '•••• •••• 4821' : isOfficer ? '•••• •••• 4821' : '•••• •••• 2176';
  const govtId = user?.governmentIdNumber
    ? `•••• •••• ${user.governmentIdNumber.slice(-4)}`
    : defaultGovtId;

  const defaultEmail = isCitizen
    ? 'amit.kumar@example.com'
    : isOfficer
    ? 'asha.kulkarni@maharashtra.gov.in'
    : 'rajesh.sharma@nic.in';
  const email = user?.email || defaultEmail;

  const defaultMobile = isCitizen
    ? '+91 98765 43210'
    : isOfficer
    ? null
    : '+91 98100 11223';
  const mobile = user?.mobileNumber || defaultMobile;

  const verificationMethod = isCitizen
    ? 'Aadhaar eKYC'
    : 'Aadhaar eKYC + Dept Records';

  const title = isCitizen
    ? 'IDENTITY & CONTACT VERIFICATION'
    : 'IDENTITY & VERIFICATION';

  return (
    <ProfileCard
      icon={<ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title={title}
    >
      <div className="space-y-3">
        {/* Government Identity */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Government ID</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-text-heading">{govtId}</span>
            <StatusPill status="verified" size="sm" />
          </div>
        </div>

        {/* Employee Verification (for Officer/Admin) */}
        {!isCitizen && (
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
            <span className="text-xs text-text-muted font-medium">Employee verification</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-heading">Verified</span>
              <StatusPill status="verified" size="sm" />
            </div>
          </div>
        )}

        {/* Email Address */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">
            {isCitizen ? 'Email address' : 'Official email'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-heading truncate max-w-[160px] sm:max-w-[220px]">
              {email}
            </span>
            <StatusPill status="verified" size="sm" />
          </div>
        </div>

        {/* Mobile Number */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Mobile number</span>
          <div className="flex items-center gap-2">
            {mobile ? (
              <>
                <span className="text-xs font-mono font-medium text-text-heading">{mobile}</span>
                <StatusPill status="verified" size="sm" />
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-text-muted">Not provided</span>
                {onChangeMobile && (
                  <button
                    type="button"
                    onClick={onChangeMobile}
                    aria-label="Add Mobile"
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition"
                  >
                    + Add
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Last Verification Date */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Last verification</span>
          <span className="text-xs font-medium text-text-heading">
            {isOfficer ? '10 Sep 2026' : isAdmin ? '09 Sep 2026' : '10 Sep 2026'}
          </span>
        </div>

        {/* Verification Method */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Verification method</span>
          <span className="text-xs font-medium text-text-heading">{verificationMethod}</span>
        </div>

        {/* Encryption note */}
        <div className="mt-2.5 p-2.5 rounded-xl bg-surface-2 dark:bg-surface-2/60 border border-[var(--border)] flex items-start gap-2 text-[11px] text-text-secondary">
          <Lock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Sensitive identity information is encrypted and visible only to authorized personnel.</span>
        </div>

        {/* Bottom Actions */}
        <div className="pt-2 flex flex-wrap gap-2.5">
          {isCitizen ? (
            <>
              <button
                type="button"
                onClick={onChangeEmail}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-surface-1 hover:bg-surface-2 text-text-heading transition shadow-xs"
              >
                Change Email
              </button>
              <button
                type="button"
                onClick={onChangeMobile}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-surface-1 hover:bg-surface-2 text-text-heading transition shadow-xs"
              >
                Change Mobile
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onUpdateDetails}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-surface-1 hover:bg-surface-2 text-text-heading transition shadow-xs"
              >
                Update Details
              </button>
              <button
                type="button"
                onClick={onViewHistory}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-surface-1 hover:bg-surface-2 text-text-heading transition shadow-xs"
              >
                View Verification History
              </button>
            </>
          )}
        </div>
      </div>
    </ProfileCard>
  );
};

export default IdentityVerificationCard;
