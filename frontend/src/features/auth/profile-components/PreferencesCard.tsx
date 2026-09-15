import React from 'react';
import { Sliders, Check } from 'lucide-react';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';

interface PreferencesCardProps {
  mode?: 'citizen' | 'officer' | 'admin';
}

export const PreferencesCard: React.FC<PreferencesCardProps> = ({
  mode = 'citizen',
}) => {
  const isOfficer = mode === 'officer';

  return (
    <ProfileCard
      icon={<Sliders className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="PREFERENCES"
    >
      <div className="space-y-3">
        {/* Language */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Language</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-heading">English</span>
            <StatusPill status="active" label="Enabled" size="sm" />
          </div>
        </div>

        {/* Regional Language */}
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
          <span className="text-xs text-text-muted font-medium">Regional language</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-heading">{isOfficer ? 'Marathi' : 'Hindi'}</span>
            <StatusPill status="user-provided" size="sm" />
          </div>
        </div>

        {isOfficer ? (
          <>
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Map display</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">Standard</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-text-muted font-medium">Default layer</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">Cadastral Parcels</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Date Format */}
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Date format</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading font-mono">DD MMM YYYY</span>
                <StatusPill status="user-provided" size="sm" />
              </div>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-text-muted font-medium">Notifications</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">Email, In-app</span>
                <StatusPill status="user-provided" size="sm" />
              </div>
            </div>

            {/* Accessibility */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-text-muted font-medium">Accessibility</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-heading">Standard</span>
                <StatusPill status="user-provided" size="sm" />
              </div>
            </div>
          </>
        )}
      </div>
    </ProfileCard>
  );
};

export default PreferencesCard;