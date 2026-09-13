import React from 'react';
import { ShieldCheck, Mail, Smartphone, ExternalLink } from 'lucide-react';
import { ProfileField } from './ProfileField';
import { AuthUser } from '../auth';

function maskId(value: string): string {
  if (!value) return '•••• •••• 4821';
  const visible = value.slice(-4);
  return '•••• •••• ' + visible;
}

interface VerificationCardProps {
  user?: AuthUser;
  onVerifyClick?: () => void;
  onUpdateClick?: () => void;
  onHistoryClick?: () => void;
}

const VerificationCard: React.FC<VerificationCardProps> = ({ user, onVerifyClick, onUpdateClick, onHistoryClick }) => {
  const email = 'asha.kulkarni@maharashtra.gov.in';
  const emailStatus = 'verified';
  const mobile = user?.mobileNumber || 'Not provided';
  const mobileStatus = user?.mobileVerified ? 'verified' : user?.mobileNumber ? 'pending' : 'not-provided';
  const aadhaarMasked = user?.governmentIdNumber ? maskId(user.governmentIdNumber) : '•••• •••• 4821';

  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">Identity & Verification</h3>
        </div>
        <div className="flex items-center gap-2">
          {onUpdateClick && (
            <button
              type="button"
              onClick={onUpdateClick}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
            >
              <Pencil className="w-3 h-3" aria-hidden="true" />
              Update Details
            </button>
          )}
          {onHistoryClick && (
            <button
              type="button"
              onClick={onHistoryClick}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              View History
            </button>
          )}
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Government Identity</h4>
            </div>
            <ProfileField label="Aadhaar (masked)" value={aadhaarMasked} />
            <ProfileField label="Verification method" value="Aadhaar eKYC + Department Records" />
            <ProfileField label="Last verification" value="10 Sep 2026" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Official Email</h4>
            </div>
            <ProfileField label="Email" value={email} />
            <ProfileField label="Status" value="Department Verified" />
          </div>
        </div>
        <div className="border-t border-ink/20 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Mobile Number</h4>
          </div>
          <ProfileField label="Mobile" value={mobile} />
          <ProfileField label="Status" value={user?.mobileVerified ? 'Mobile Verified' : 'Verify/Add'} />
        </div>
        <p className="text-xs text-ink/50 border-l-2 border-accent pl-3">
          Sensitive identity information is encrypted and visible only to authorized personnel.
        </p>
        <div className="flex flex-wrap gap-2 pt-4 border-t border-ink/20">
          {onVerifyClick && (
            <button
              type="button"
              onClick={onVerifyClick}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Verify
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Pencil: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export default VerificationCard;