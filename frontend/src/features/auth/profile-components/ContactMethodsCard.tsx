import React from 'react';
import { Mail, Smartphone, Phone, MapPin, Bell, Settings } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ContactMethodCard from '../ContactMethodCard';
import { AuthUser } from '../auth';
import { useTranslation } from '../../../context/LanguageContext';

interface ContactMethodsCardProps {
  user: AuthUser;
}

const ContactMethodsCard: React.FC<ContactMethodsCardProps> = ({ user }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('contactMethodsCard.heading')}</h3>
        </div>
        <button
          type="button"
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          <Bell className="w-3 h-3" aria-hidden="true" />
          {t('contactMethodsCard.managePreferences')}
        </button>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">{t('contactMethodsCard.contactMethods')}</h4>
          </div>
          <div className="space-y-3">
            <ContactMethodCard method="EMAIL" user={user} />
            <ContactMethodCard method="MOBILE" user={user} />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Phone className="w-4 h-4 text-primary" aria-hidden="true" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">{t('contactMethodsCard.otherContactDetails')}</h4>
          </div>
          <div className="space-y-4">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('contactMethodsCard.officePhone')}</dt>
              <dd className="text-ink font-medium">020-2612-3456</dd>
              <span className="inline-flex items-center gap-1 mt-1 border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary border-primary/50">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                {t('contactMethodsCard.verifiedLine')}
              </span>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('contactMethodsCard.officeAddress')}</dt>
              <dd className="text-ink font-medium">District Collectorate, Shivajinagar,</dd>
              <dd className="text-ink font-medium">Pune - 411005, Maharashtra</dd>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-ink/50">{t('contactMethodsCard.notificationPreferences')}</h4>
            </div>
            <div className="space-y-2">
              {[
                { label: t('contactMethodsCard.smsNotifications'), active: true },
                { label: t('contactMethodsCard.emailNotifications'), active: true },
                { label: t('contactMethodsCard.inAppNotifications'), active: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-ink font-medium">{item.label}</span>
                  <span className={`inline-flex items-center gap-1 border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${item.active ? 'bg-primary/15 text-primary border-primary/50' : 'bg-muted text-ink/50 border-ink/15'}`}>
                    {item.active ? t('contactMethodsCard.enabled') : t('contactMethodsCard.disabled')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactMethodsCard;