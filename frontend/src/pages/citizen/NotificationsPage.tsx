import React from 'react';
import NotificationFeed from '../../features/notifications/NotificationFeed';
import BackButton from '../../components/BackButton';
import { useTranslation } from '../../context/LanguageContext';

// The real in-app notification feed (docs/FRONTEND_UPGRADE_SPEC.md §11 item
// 5, resolved 2026-09-09: in-app only) - replaces the old ComingSoonCard
// placeholder. Shared with the Officer Portal's own Notifications page (see
// features/notifications/NotificationFeed.tsx).
const NotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <BackButton variant="ink" className="mb-3" />
      <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink mb-1">{t('notificationsPage.heading')}</h1>
      <p className="text-ink/60 mb-4">{t('citizenNotificationsPage.subtitle')}</p>
      <NotificationFeed />
    </div>
  );
};

export default NotificationsPage;
