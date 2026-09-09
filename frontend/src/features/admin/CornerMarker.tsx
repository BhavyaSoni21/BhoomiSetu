import React from 'react';
import { Triangle } from 'lucide-react';

// Admin = triangle + gold (docs/design.md §2 role mapping) - the small
// corner marker repeated on every Admin Portal card, echoing the same
// wayfinding shape the app switcher/nav already use for this portal.
// Shared across AdminDashboardPage/AdminDepartmentsPage/SystemMonitoringPage
// now that the Admin Portal is split into multiple pages (Phase 3).
const CornerMarker: React.FC = () => (
  <span
    className="absolute -top-3 -right-3 w-7 h-7 bg-accent border-2 border-ink flex items-center justify-center shadow-hard-sm"
    aria-hidden="true"
  >
    <Triangle className="w-3.5 h-3.5 fill-ink text-ink" />
  </span>
);

export default CornerMarker;
