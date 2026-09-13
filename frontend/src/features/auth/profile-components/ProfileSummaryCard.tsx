import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

interface ProfileSummaryCardProps {
  name: string;
  role: string;
  department?: string;
  avatar?: string;
  initials?: string;
  status: 'Verified Government Account' | string;
  memberSince?: string;
  lastActive: string;
  completeness: number;
  message: string;
  children?: React.ReactNode;
}

const ProfileSummaryCard: React.FC<ProfileSummaryCardProps> = ({
  name,
  role,
  department,
  avatar,
  initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
  status,
  memberSince,
  lastActive,
  completeness,
  message,
  children,
}) => {
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink">Profile Summary</h2>
          <p className="text-xs text-ink/50 mt-1">Official BhoomiSetu account record</p>
        </div>
        <span className="inline-flex items-center gap-2 border-2 border-primary/50 bg-primary/15 text-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          {status}
        </span>
      </div>
      <div className="p-6 flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 shrink-0 flex flex-col items-center text-center gap-4">
          {avatar ? (
            <img src={avatar} alt={`${name} profile photo`} className="w-24 h-24 object-cover border-2 border-ink shadow-hard-sm" />
          ) : (
            <div className="w-24 h-24 flex items-center justify-center bg-primary text-white text-2xl font-black border-2 border-ink shadow-hard-sm" aria-hidden="true">
              {initials}
            </div>
          )}
          <div>
            <h3 className="text-xl font-black font-display text-ink">{name}</h3>
            <p className="text-sm text-ink/60 mt-1">{role}</p>
          </div>
          <div className="w-full">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-ink/50 mb-1">
              <span>Profile completeness</span>
              <span>{completeness}%</span>
            </div>
            <div className="h-3 border-2 border-ink bg-surface">
              <div
                className="h-full bg-primary"
                style={{ width: `${completeness}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completeness}
                aria-label="Profile completeness"
              />
            </div>
          </div>
          {message && <p className="text-xs text-ink/60 border-l-2 border-accent pl-3">{message}</p>}
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Account Details</h4>
            </div>
            <dl className="space-y-3">
              {memberSince ? (
                <div><dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Member Since</dt><dd className="text-ink font-medium">{memberSince}</dd></div>
              ) : null}
              {department ? (
                <div><dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Department</dt><dd className="text-ink font-medium">{department}</dd></div>
              ) : null}
              <div><dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Last active</dt><dd className="text-ink font-medium">{lastActive}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Status</dt><dd className="text-ink font-medium">Active</dd></div>
            </dl>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Account Information</h4>
            </div>
            <dl className="space-y-3">
              <div><dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Identity</dt><dd className="text-ink font-medium">Verified Govt Identity</dd></div>
              <div><dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Government ID</dt><dd className="text-ink font-medium">•••• •••• 4821</dd></div>
              <div><dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Employee ID</dt><dd className="text-ink font-medium">LRM******3421</dd></div>
            </dl>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

export default ProfileSummaryCard;