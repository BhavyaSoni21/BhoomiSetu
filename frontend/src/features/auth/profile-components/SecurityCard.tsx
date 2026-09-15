import React from 'react';
import { ShieldCheck, LockKeyhole, Smartphone, ExternalLink } from 'lucide-react';
import { ProfileField } from './ProfileField';
import { useTranslation } from '../../../context/LanguageContext';

interface SecurityCardProps {
  on2facClick?: () => void;
  onSessionsClick?: () => void;
  onPasswordClick?: () => void;
}

const SecurityCard: React.FC<SecurityCardProps> = ({ on2facClick, onSessionsClick, onPasswordClick }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('securityCard.heading')}</h3>
        </div>
        <span className="inline-flex items-center gap-1 border-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary border-primary/50">
          <ShieldCheck className="w-3 h-3" aria-hidden="true" />
          {t('securityCard.protected')}
        </span>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <LockKeyhole className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">{t('securityCard.securitySettings')}</h4>
          </div>
          <div className="space-y-4">
            <ProfileField label={t('securityCard.twoFactor')} value={t('securityCard.enabled')} />
            <ProfileField label={t('securityCard.lastPasswordChange')} value="02 Aug 2026" />
            <ProfileField label={t('securityCard.activeSessions')} value="2 active sessions" />
            <ProfileField label={t('securityCard.trustedDevices')} value="2 trusted devices" />
            <ProfileField label={t('securityCard.loginAlerts')} value={t('securityCard.enabled')} />
            <ProfileField label={t('securityCard.recoveryContact')} value={t('securityCard.configured')} />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">{t('securityCard.recentEvents')}</h4>
          </div>
          <div className="space-y-3">
            {[
              { label: t('securityCard.event.deviceRegistered'), meta: 'Pune office · 02 Aug 2026', status: 'completed' },
              { label: t('securityCard.event.passwordChanged'), meta: 'Pune office · 02 Aug 2026', status: 'completed' },
              { label: t('securityCard.event.sessionEnded'), meta: 'Pune office · 28 Jul 2026', status: 'completed' },
            ].map((event) => (
              <div key={event.label} className="border-l-2 border-primary/50 pl-3">
                <p className="text-sm font-medium text-ink">{event.label}</p>
                <p className="text-xs text-ink/50 mt-0.5">{event.meta}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-ink/20 flex flex-wrap gap-2">
            {on2facClick && (
              <button type="button" onClick={on2facClick} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">{t('securityCard.manage2fa')}</button>
            )}
            {onSessionsClick && (
              <button type="button" onClick={onSessionsClick} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">{t('securityCard.reviewSessions')}</button>
            )}
            {onPasswordClick && (
              <button type="button" onClick={onPasswordClick} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition">{t('securityCard.changePassword')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityCard;