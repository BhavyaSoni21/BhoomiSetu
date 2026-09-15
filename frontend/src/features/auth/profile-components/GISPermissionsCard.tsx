import React from 'react';
import { Layers, ShieldCheck, Check, ExternalLink } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';

interface GISPermissionsCardProps {
  onAccessMatrixClick?: () => void;
  onPermissionRequestClick?: () => void;
}

export const GISPermissionsCard: React.FC<GISPermissionsCardProps> = ({
  onAccessMatrixClick,
  onPermissionRequestClick,
}) => {
  const layers = [
    'Cadastral parcel layer',
    'Survey & resurvey layer',
    'Ownership & mutation records',
    'Historical imagery',
    'Land-use classification',
    'Public infrastructure layer',
  ];

  const scopes = [
    { name: 'View', granted: true },
    { name: 'Verify', granted: true },
    { name: 'Approve', granted: true },
    { name: 'Export', granted: true },
  ];

  return (
    <ProfileCard
      icon={<Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="GIS ACCESS & PERMISSIONS"
    >
      <div className="space-y-4">
        {/* Access Level */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Access level</span>
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            District Land Records Officer
          </span>
        </div>

        {/* Available Layers */}
        <div>
          <span className="text-xs font-bold text-text-heading block mb-2">Available layers</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {layers.map((layer) => (
              <div
                key={layer}
                className="flex items-center gap-2 p-2 rounded-xl bg-surface-2 dark:bg-surface-2/60 text-xs text-text-secondary"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className="truncate">{layer}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Permission Scopes */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60">
          <span className="text-xs font-bold text-text-heading block mb-2">Permission scope</span>
          <div className="flex flex-wrap gap-2">
            {scopes.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              >
                <Check className="w-3 h-3" />
                <span>{s.name}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Last review */}
        <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-gray-100 dark:border-gray-800/60">
          <span>Last review: <strong className="text-text-secondary font-medium">10 Sep 2026</strong></span>
          <span>Permission admin: <strong className="text-text-secondary font-medium">District Land Records Admin</strong></span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {onAccessMatrixClick && (
            <button
              type="button"
              onClick={onAccessMatrixClick}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-surface-1 hover:bg-surface-2 text-text-heading transition shadow-xs flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              <span>View Access Matrix</span>
            </button>
          )}
          {onPermissionRequestClick && (
            <button
              type="button"
              onClick={onPermissionRequestClick}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] bg-surface-1 hover:bg-surface-2 text-text-heading transition shadow-xs"
            >
              Request Permission Change
            </button>
          )}
        </div>
      </div>
    </ProfileCard>
  );
};

export default GISPermissionsCard;