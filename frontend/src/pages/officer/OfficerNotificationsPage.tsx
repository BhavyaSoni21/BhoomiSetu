import React from 'react';
import NotificationFeed from '../../features/notifications/NotificationFeed';

// The real in-app notification feed (docs/FRONTEND_UPGRADE_SPEC.md §11 item
// 5, resolved 2026-09-09: in-app only) - replaces the old ComingSoonCard
// placeholder. Shared with the Citizen Portal's own Notifications page (see
// features/notifications/NotificationFeed.tsx).
const OfficerNotificationsPage: React.FC = () => (
  <div className="max-w-2xl">
    <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink mb-1">Notifications</h1>
    <p className="text-ink/60 mb-4">New requests assigned to your department, and governance-alert activity that concerns it.</p>
    <NotificationFeed />
  </div>
);

export default OfficerNotificationsPage;
