import React from 'react';
import { ShieldCheck, LockKeyhole, Smartphone, ExternalLink } from 'lucide-react';
import { ProfileField } from './ProfileField';

interface SecurityCardProps {
  on2facClick?: () => void;
  onSessionsClick?: () => void;
  onPasswordClick?: () => void;
}

const SecurityCard: React.FC<SecurityCardProps> = ({ on2facClick, onSessionsClick, onPasswordClick }) => {
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">Account Security</h3>
        </div>
        <span className="inline-flex items-center gap-1 border-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary border-primary/50">
          <ShieldCheck className="w-3 h-3" aria-hidden="true" />
          Protected
        </span>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <LockKeyhole className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Security Settings</h4>
          </div>
          <div className="space-y-4">
            <ProfileField label="Two-factor authentication" value="Enabled" />
            <ProfileField label="Last password change" value="02 Aug 2026" />
            <ProfileField label="Active sessions" value="2 active sessions" />
            <ProfileField label="Trusted devices" value="2 trusted devices" />
            <ProfileField label="Login alerts" value="Enabled" />
            <ProfileField label="Recovery email/mobile" value="Configured" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">Recent Security Events</h4>
          </div>
          <div className="space-y-3">
            {[
              { label: 'New device registered', meta: 'Pune office · 02 Aug 2026', status: 'completed' },
              { label: 'Password changed', meta: 'Pune office · 02 Aug 2026', status: 'completed' },
              { label: 'Session ended on another device', meta: 'Pune office · 28 Jul 2026', status: 'completed' },
            ].map((event) => (
              <div key={event.label} className="border-l-2 border-primary/50 pl-3">
                <p className="text-sm font-medium text-ink">{event.label}</p>
                <p className="text-xs text-ink/50 mt-0.5">{event.meta}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-ink/20 flex flex-wrap gap-2">
            {on2facClick && (
              <button type="button" onClick={on2facClick} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">Manage 2FA</button>
            )}
            {onSessionsClick && (
              <button type="button" onClick={onSessionsClick} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">Review Active Sessions</button>
            )}
            {onPasswordClick && (
              <button type="button" onClick={onPasswordClick} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">Change Password</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityCard;