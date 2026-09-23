import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';
import apiService from '../../../services/apiService';
import { AuditLogEntry } from '../../../types/auditLog';

// Same underscore-to-title-case treatment AdminActivitySummary uses.
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

// Audit rows are recorded facts; only reject/delete actions read as "Failed".
function statusFor(action: string): string {
  return /REJECT|DELETE|FAIL/.test(action) ? 'Failed' : 'Completed';
}

export const ActivityTimeline: React.FC = () => {
  const { data: entries = [], isLoading } = useQuery<AuditLogEntry[]>(['profile-recent-activity'], async () => {
    const response = await apiService.get('/audit', { params: { limit: 4 } });
    return response.data;
  });
  const activities = entries.map((entry) => ({
    id: entry.id,
    action: formatAction(entry.action),
    timestamp: formatTimestamp(entry.createdAt),
    status: statusFor(entry.action),
  }));

  return (
    <ProfileCard
      icon={<Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="RECENT ACTIVITY"
    >
      <div className="space-y-3">
        {isLoading && <p className="text-xs text-text-muted">Loading...</p>}
        {!isLoading && activities.length === 0 && <p className="text-xs text-text-muted">No activity recorded yet.</p>}
        {activities.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800/60 last:border-none"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text-heading leading-tight">{item.action}</p>
              <span className="text-[11px] font-mono text-text-muted mt-0.5 block">{item.timestamp}</span>
            </div>
            <StatusPill status={item.status.toLowerCase()} label={item.status} size="sm" />
          </div>
        ))}

        <div className="pt-2 text-right">
          <Link
            to="/officer/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <span>View Full Activity Log</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default ActivityTimeline;
