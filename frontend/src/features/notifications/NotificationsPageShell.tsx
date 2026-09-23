import React from 'react';
import NotificationFeed from './NotificationFeed';
import BackButton from '../../components/BackButton';
import { useTranslation } from '../../context/LanguageContext';

// Shared page shell behind both the Citizen and Officer "Notifications" routes
// (docs/FRONTEND_UPGRADE_SPEC.md §11 item 5). The two portal pages were
// byte-identical apart from their subtitle key, so the only per-portal knob is
// `subtitleKey`; everything else (back button, heading, the real
// NotificationFeed) lives here once.
const NotificationsPageShell: React.FC<{ subtitleKey: string }> = ({ subtitleKey }) => {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <BackButton variant="ink" className="mb-3" />
      <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink mb-1">{t('notificationsPage.heading')}</h1>
      <p className="text-ink/60 mb-4">{t(subtitleKey)}</p>
      <NotificationFeed />
    </div>
  );
};

export default NotificationsPageShell;
