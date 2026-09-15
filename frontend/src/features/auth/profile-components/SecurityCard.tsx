import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import { LiveStatusDot } from './LiveStatusDot';

interface SecurityCardProps {
  onManage2FA?: () => void;
  onChangePassword?: () => void;
  onViewSessions?: () => void;
  onAddRecovery?: () => void;
}

export const SecurityCard: React.FC<SecurityCardProps> = ({
  onManage2FA,
  onChangePassword,
  onViewSessions,
  onAddRecovery,
}) => {
  return (
    <ProfileCard
      icon={<Lock className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="ACCOUNT SECURITY"
      enterDelay={7}
    >
      <div className="space-y-3">
        {/* 2FA */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Two-factor authentication</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Enabled</span>
            <button
              type="button"
              onClick={onManage2FA}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              Manage
            </button>
          </div>
        </div>

        {/* Password */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Last password change</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-text-heading">02 Aug 2026</span>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Active sessions</span>
          <div className="flex items-center gap-2">
            <LiveStatusDot color="green" label="2 active sessions" pulse />
            <button
              type="button"
              onClick={onViewSessions}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              View all
            </button>
          </div>
        </div>

        {/* Trusted Devices */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Trusted devices</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-heading">2 devices</span>
            <button
              type="button"
              onClick={onViewSessions}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              View all
            </button>
          </div>
        </div>

        {/* Login Alerts */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Login alerts</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Enabled</span>
            <button
              type="button"
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              Manage
            </button>
          </div>
        </div>

        {/* Recovery Contact */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-text-muted font-medium">Recovery contact</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Not provided</span>
            <button
              type="button"
              onClick={onAddRecovery}
              aria-label="Add recovery contact"
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              + Add
            </button>
          </div>
        </div>
      </div>
    </ProfileCard>
  );
};

export default SecurityCard;