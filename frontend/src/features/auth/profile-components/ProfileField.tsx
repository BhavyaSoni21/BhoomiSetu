import React from 'react';
import StatusBadge from './StatusBadge';

interface ProfileFieldProps {
  label: string;
  value: string | React.ReactNode;
  status?: 'verified' | 'pending' | 'not-provided' | 'active' | 'success' | 'warning';
  secondary?: boolean;
}

export const ProfileField: React.FC<ProfileFieldProps> = ({ label, value, status, secondary = false }) => {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{label}</label>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-ink font-medium">{value}</span>
        {status && (
          <StatusBadge variant={status as any}>
            {status === 'verified' ? 'Verified' : status === 'pending' ? 'Pending' : status === 'not-provided' ? 'Not Provided' : status === 'active' ? 'Active' : status === 'success' ? 'Success' : 'Warning'}
          </StatusBadge>
        )}
      </div>
    </div>
  );
};

export default ProfileField;