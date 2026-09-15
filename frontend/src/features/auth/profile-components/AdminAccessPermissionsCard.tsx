import React from 'react';
import { ShieldCheck, Check, ExternalLink } from 'lucide-react';
import { ProfileCard } from './ProfileCard';

interface AdminAccessPermissionsCardProps {
  onViewAccessMatrix?: () => void;
}

export const AdminAccessPermissionsCard: React.FC<AdminAccessPermissionsCardProps> = ({
  onViewAccessMatrix,
}) => {
  const permissions = [
    'User management',
    'Role management',
    'Permission management',
    'GIS layer administration',
    'Governance configuration',
    'Request workflow administration',
    'Audit access',
    'System configuration',
  ];

  return (
    <ProfileCard
      icon={<ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="ADMIN ACCESS & PERMISSIONS"
    >
      <div className="space-y-4">
        {/* Role & Access Level */}
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/60">
          <div>
            <span className="text-[11px] font-medium text-text-muted">Admin role</span>
            <p className="text-xs font-semibold text-text-heading">State Administrator</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-text-muted">Access level</span>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Full System Access</p>
          </div>
        </div>

        {/* Permission Scope Checklist */}
        <div>
          <span className="text-xs font-bold text-text-heading block mb-2">Permission scope</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {permissions.map((perm) => (
              <div
                key={perm}
                className="flex items-center gap-2 p-2 rounded-xl bg-surface-2 dark:bg-surface-2/60 text-xs text-text-secondary"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className="truncate">{perm}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Review metadata */}
        <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-gray-100 dark:border-gray-800/60">
          <span>Last review: <strong className="text-text-secondary font-medium">01 Sep 2026</strong></span>
          <span>Approved by: <strong className="text-text-secondary font-medium">Me (Super Admin)</strong></span>
        </div>

        {/* Action button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onViewAccessMatrix}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-surface-1 hover:bg-surface-2 text-text-heading transition shadow-xs"
          >
            <ExternalLink className="w-3 h-3" />
            <span>View Access Matrix</span>
          </button>
        </div>
      </div>
    </ProfileCard>
  );
};

export default AdminAccessPermissionsCard;
