import React from 'react';
import { Activity } from 'lucide-react';
import SystemMonitoring from '../../features/admin/SystemMonitoring';
import CornerMarker from '../../features/admin/CornerMarker';

// Admin Portal "System Monitoring" page (docs/FRONTEND_UPGRADE_SPEC.md §7,
// Phase 3) - "the most tractable of the four [pieces] - this can genuinely
// reuse GET /analytics/summary and GET /audit, just presented as its own
// page rather than cards sharing space with User Management."
const SystemMonitoringPage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">System Monitoring</h1>
      <p className="text-ink/60 mt-1">Platform health and the full officer/admin activity log.</p>
    </div>

    <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
      <CornerMarker />
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">System Overview</h2>
      </div>
      <SystemMonitoring />
    </div>
  </div>
);

export default SystemMonitoringPage;
