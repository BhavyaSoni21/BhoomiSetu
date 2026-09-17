import React from 'react';

export interface ProfileCardProps {
  icon?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  headerBorder?: boolean;
  /** Stagger index 1–8 for entrance animation delay */
  enterDelay?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  icon,
  iconBg = 'bg-emerald-50 dark:bg-emerald-950/60',
  iconColor = 'text-emerald-700 dark:text-emerald-300',
  title,
  subtitle,
  action,
  children,
  className = '',
  id,
  headerBorder = false,
  enterDelay,
}) => {
  const enterClass = enterDelay
    ? `animate-card-enter animate-card-enter-${enterDelay}`
    : 'animate-card-enter';

  return (
    <div
      id={id}
      className={`profile-card profile-card-lift bg-white dark:bg-surface-1 border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 ${enterClass} ${className}`}
    >
      {/* Section header row */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${
          headerBorder ? 'pb-3.5 mb-4 border-b border-gray-100 dark:border-gray-800' : 'mb-4'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className={`icon-chip ${iconBg} ${iconColor} rounded-xl shadow-2xs`}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold font-heading text-text-heading tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </div>

      {/* Content */}
      <div className="text-text-primary text-sm">{children}</div>
    </div>
  );
};

export default ProfileCard;
