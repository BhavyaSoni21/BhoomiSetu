import React from 'react';
import { CheckCircle2, Clock, AlertCircle, ShieldAlert } from 'lucide-react';

export type StatusPillVariant =
  | 'verified'
  | 'pending'
  | 'user-provided'
  | 'unverified'
  | 'rejected'
  | 'disputed'
  | 'not-provided'
  | 'granted'
  | 'active';

interface StatusPillProps {
  status?: StatusPillVariant | string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
  icon?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status = 'verified',
  label,
  className = '',
  size = 'md',
  icon = true,
}) => {
  const norm = (status || '').toLowerCase().trim();

  let styles = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  let IconComponent: React.ComponentType<{ className?: string }> | null = CheckCircle2;
  let displayLabel = label;

  if (norm === 'verified' || norm === 'granted' || norm === 'active' || norm === 'successful' || norm === 'completed' || norm === 'registered') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    IconComponent = CheckCircle2;
    if (!displayLabel) {
      displayLabel = norm === 'granted' ? 'Granted' : norm === 'active' ? 'Active' : norm === 'registered' ? 'Registered' : 'Verified';
    }
  } else if (
    norm === 'pending' ||
    norm === 'pending-verification' ||
    norm === 'user-provided' ||
    norm === 'user provided' ||
    norm === 'unverified' ||
    norm === 'in review' ||
    norm === 'in_progress'
  ) {
    styles = 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    IconComponent = Clock;
    if (!displayLabel) {
      displayLabel = norm.includes('user') ? 'User provided' : norm === 'unverified' ? 'Unverified' : 'Pending';
    }
  } else if (norm === 'rejected' || norm === 'disputed' || norm === 'failed' || norm === 'high-risk') {
    styles = 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
    IconComponent = AlertCircle;
    if (!displayLabel) {
      displayLabel = norm === 'disputed' ? 'Disputed' : norm === 'failed' ? 'Failed' : 'Rejected';
    }
  } else if (norm === 'not-provided' || norm === 'not provided') {
    styles = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    IconComponent = ShieldAlert;
    if (!displayLabel) {
      displayLabel = 'Not provided';
    }
  } else {
    // Custom label fallback
    displayLabel = label || status;
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors shadow-xs select-none ${sizeClass} ${styles} ${className}`}
    >
      {icon && IconComponent && <IconComponent className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} aria-hidden="true" />}
      <span>{displayLabel}</span>
    </span>
  );
};

export default StatusPill;
