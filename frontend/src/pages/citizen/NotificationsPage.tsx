import React from 'react';
import NotificationsPageShell from '../../features/notifications/NotificationsPageShell';

// Thin citizen wrapper - all markup lives in the shared shell; this only
// picks the citizen subtitle. (Officer Portal has its own wrapper with the
// officer subtitle.)
const NotificationsPage: React.FC = () => (
  <NotificationsPageShell subtitleKey="citizenNotificationsPage.subtitle" />
);

export default NotificationsPage;
