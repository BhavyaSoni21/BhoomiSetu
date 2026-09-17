import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProfileCard } from './ProfileCard';
import apiService from '../../../services/apiService';
import { AuditLogEntry } from '../../../types/auditLog';

// "Approved officer access" -> "Workflow Step Approved" - the same
// underscore-to-title-case treatment AnalyticsDashboard.tsx's
// formatEnumLabel uses for other backend enum values.
function formatAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const AdminActivitySummary: React.FC = () => {
  // GET /audit is admin-only - safe to call unconditionally here since this
  // card is only ever rendered on the admin dashboard (RoleDashboard.tsx).
  const { data: entries = [], isLoading } = useQuery<AuditLogEntry[]>(['admin-recent-activity'], async () => {
    const response = await apiService.get('/audit', { params: { limit: 4 } });
    return response.data;
  });
  const adminEvents = entries.map((entry) => ({
    id: entry.id,
    action: formatAction(entry.action),
    timestamp: formatTimestamp(entry.createdAt),
  }));

  return (
    <ProfileCard
      icon={<Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="RECENT ADMINISTRATIVE ACTIVITY"
    >
      <div className="space-y-3">
        {isLoading && <p className="text-xs text-text-muted">Loading...</p>}
        {!isLoading && adminEvents.length === 0 && <p className="text-xs text-text-muted">No activity recorded yet.</p>}
        {adminEvents.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800/60 last:border-none"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text-heading">{item.action}</p>
              <span className="text-[11px] font-mono text-text-muted">{item.timestamp}</span>
            </div>
          </div>
        ))}

        <div className="pt-2 text-right">
          <Link
            to="/admin/monitoring"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <span>View Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default AdminActivitySummary;