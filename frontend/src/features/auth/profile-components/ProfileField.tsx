import React from 'react';
import StatusBadge from './StatusBadge';
import { useTranslation } from '../../../context/LanguageContext';

interface ProfileFieldProps {
  label: string;
  value: string | React.ReactNode;
  status?: 'verified' | 'pending' | 'not-provided' | 'active' | 'success' | 'warning';
  secondary?: boolean;
}

export const ProfileField: React.FC<ProfileFieldProps> = ({ label, value, status, secondary = false }) => {
  const { t } = useTranslation();
  const statusLabel: Record<NonNullable<ProfileFieldProps['status']>, string> = {
    verified: t('profileField.status.verified'),
    pending: t('profileField.status.pending'),
    'not-provided': t('profileField.status.notProvided'),
    active: t('profileField.status.active'),
    success: t('profileField.status.success'),
    warning: t('profileField.status.warning'),
  };
  return (
    <div className="mb-4 flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{label}</label>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-ink font-medium">{value}</span>
        {status && (
          <StatusBadge variant={status as any}>
            {statusLabel[status]}
          </StatusBadge>
        )}
      </div>
    </div>
  );
};

export default ProfileField;