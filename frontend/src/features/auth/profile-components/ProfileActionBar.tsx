import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';

interface ProfileActionBarProps {
  onSaveClick?: () => void;
  onCancelClick?: () => void;
  onDownloadClick?: () => void;
  onSupportClick?: () => void;
  onEditClick?: () => void;
}

const ProfileActionBar: React.FC<ProfileActionBarProps> = ({ onSaveClick, onCancelClick, onDownloadClick, onSupportClick, onEditClick }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-surface border-2 border-ink shadow-hard-lg p-6">
      <p className="text-sm text-ink/60 mb-4">
        Your profile information helps BhoomiSetu route land-governance requests to the correct authorized team.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {onEditClick && (
            <button
              type="button"
              onClick={onEditClick}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              Edit Profile
            </button>
          )}
          {onSaveClick && (
            <button
              type="button"
              onClick={onSaveClick}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {t('citizenPortal.profileSaveCta')}
            </button>
          )}
          {onCancelClick && (
            <button
              type="button"
              onClick={onCancelClick}
              className="px-4 py-2.5 border-2 border-ink text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
            >
              Cancel
            </button>
          )}
        </div>
        {onDownloadClick && (
          <button
            type="button"
            onClick={onDownloadClick}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            Download Profile Summary
          </button>
        )}
        {onSupportClick && (
          <button
            type="button"
            onClick={onSupportClick}
            className="shrink-0 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            Contact Support
          </button>
        )}
      </div>
    </div>
  );
};

export default ProfileActionBar;