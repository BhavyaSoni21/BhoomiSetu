import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ProfileField } from './ProfileField';

interface PreferencesCardProps {
  onViewAccessMatrixClick?: () => void;
}

const PreferencesCard: React.FC<PreferencesCardProps> = ({ onViewAccessMatrixClick }) => {
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">Preferences</h3>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">Basic Preferences</h4>
            <ProfileField label="Preferred language" value="English" />
            <ProfileField label="Regional language" value="Marathi" />
            <ProfileField label="Date format" value="DD MMM YYYY" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">Map Display Preferences</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Default map layer</span>
                <span className="text-ink font-medium">Cadastral Parcels</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Map theme</span>
                <span className="text-ink font-medium">Standard</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">Accessibility & Text</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>High-contrast mode</span>
                <span className="text-ink font-medium">Off</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Text-size preference</span>
                <span className="text-ink font-medium">Medium</span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50 mb-3">System Integration</h4>
          <div className="space-y-3">
            {onViewAccessMatrixClick && (
              <button
                type="button"
                onClick={onViewAccessMatrixClick}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                View Access Matrix
              </button>
            )}
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Notification preferences</dt>
              <dd className="text-sm text-ink font-medium">Configured per section</dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesCard;