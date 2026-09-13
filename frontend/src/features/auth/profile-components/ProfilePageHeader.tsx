import React from 'react';
import { useTranslation } from 'react-i18next';
import BackButton from '../../../components/BackButton';

interface ProfilePageHeaderProps {
  onEditClick?: () => void;
}

const ProfilePageHeader: React.FC<ProfilePageHeaderProps> = ({ onEditClick }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div className="flex-1 min-w-0">
        <BackButton variant="ink" label="Back" />
        <h1 className="text-3xl font-black uppercase tracking-tight font-display text-ink mt-3">
          {t('citizenPortal.profileHeading')}
        </h1>
        <p className="text-sm text-ink/60 mt-1">
          {t('citizenPortal.profileSubtitle')}
        </p>
        <p className="text-xs text-ink/40 mt-2 font-mono">
          {t('citizenPortal.profileLastUpdated')}: 11 Sep 2026, 10:24 AM
        </p>
      </div>
      {onEditClick && (
        <button
          type="button"
          onClick={onEditClick}
          className="shrink-0 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          Edit Profile
        </button>
      )}
    </div>
  );
};

export default ProfilePageHeader;
