import React from 'react';
import { ShieldCheck, MapPin, Calendar, Clock, UserCheck } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { AnimatedCounter } from './AnimatedCounter';
import { LiveStatusDot } from './LiveStatusDot';

export interface ProfileSummaryCardProps {
  name: string;
  role?: string;
  department?: string;
  location?: string;
  avatar?: string;
  initials?: string;
  status?: string;
  isGovernmentAccount?: boolean;
  isAdminAccount?: boolean;
  memberSince?: string;
  lastActive?: string;
  completeness?: number;
  message?: string;
  linkedParcelsCount?: number | string;
  totalRequestsCount?: number | string;
  children?: React.ReactNode;
}

export const ProfileSummaryCard: React.FC<ProfileSummaryCardProps> = ({
  name,
  role = 'Citizen',
  department,
  location = 'Pune, Maharashtra',
  avatar,
  initials = name ? name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'AK',
  status = 'Active',
  isGovernmentAccount = false,
  isAdminAccount = false,
  memberSince,
  lastActive = '11 Sep 2026, 10:24 AM',
  completeness = 72,
  message = 'Add your residential address and occupation to complete your profile.',
  linkedParcelsCount,
  totalRequestsCount,
}) => {
  return (
    <div className="animate-card-enter bg-white dark:bg-surface-1 border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] profile-card-lift transition-all">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Avatar + Details */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          {avatar ? (
            <img
              src={avatar}
              alt={`${name} profile`}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-700/20 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0F3D2E] text-white flex items-center justify-center text-xl sm:text-2xl font-black font-heading shadow-xs shrink-0">
              {initials}
            </div>
          )}

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black font-heading text-text-heading tracking-tight">
                {name}
              </h2>
              <LiveStatusDot color="green" label={status} pulse />
              {isGovernmentAccount && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  Verified Government Account
                </span>
              )}
              {isAdminAccount && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  System Administrator
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              <span className="font-semibold text-text-heading flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>{role}</span>
                {department && <span className="text-text-muted">· <strong>{department}</strong></span>}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                {location}
              </span>
            </div>

            {/* DL metadata for tests & accessibility */}
            <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-text-muted pt-1">
              {memberSince && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-text-muted">Member Since</dt>
                  <dd className="text-text-secondary font-semibold">{memberSince}</dd>
                </div>
              )}
              {linkedParcelsCount !== undefined && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-text-muted">Linked Parcels</dt>
                  <dd className="text-text-secondary font-semibold font-mono">
                    {linkedParcelsCount}
                  </dd>
                </div>
              )}
              {totalRequestsCount !== undefined && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-text-muted">Total Requests</dt>
                  <dd className="text-text-secondary font-semibold font-mono">
                    {totalRequestsCount}
                  </dd>
                </div>
              )}
              {lastActive && (
                <div className="flex items-center gap-1.5">
                  <dt className="text-text-muted">Last Active</dt>
                  <dd className="text-text-secondary font-semibold">{lastActive}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Right: Profile Completeness */}
        <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-surface-2/60 border border-[var(--border)] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-text-heading">Profile completeness:</span>
            <span className="font-black text-emerald-700 dark:text-emerald-400 font-mono text-sm">{completeness}%</span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${completeness}%` }}
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>

          {message && (
            <p className="text-[11px] text-text-secondary leading-tight">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSummaryCard;