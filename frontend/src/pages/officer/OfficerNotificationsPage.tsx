import React from 'react';
import NotificationsPageShell from '../../features/notifications/NotificationsPageShell';

// Thin officer wrapper - shares the same shell as the Citizen Portal's
// Notifications page, differing only in the subtitle string.
const OfficerNotificationsPage: React.FC = () => (
  <NotificationsPageShell subtitleKey="officerNotificationsPage.subtitle" />
);

export default OfficerNotificationsPage;
