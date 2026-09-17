import React from 'react';

export type StatusVariant = 'verified' | 'pending' | 'not-provided' | 'active' | 'warning' | 'success';

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<StatusVariant, string> = {
  verified: 'bg-primary/15 text-primary border-primary/50',
  pending: 'bg-accent/20 text-secondary-strong border-accent/50',
  'not-provided': 'bg-muted text-ink/60 border-ink/15',
  active: 'bg-primary/15 text-primary border-primary/50',
  warning: 'bg-accent/20 text-secondary-strong border-accent/50',
  success: 'bg-primary/15 text-primary border-primary/50',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ variant = 'verified', children, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${VARIANT_STYLES[variant]} ${className}`}
    >
      {variant === 'verified' && <CheckIcon className="w-3 h-3" />}
      {variant === 'active' && <ActiveIcon className="w-3 h-3" />}
      {children}
    </span>
  );
};

const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ActiveIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="6" />
  </svg>
);

export default StatusBadge;
