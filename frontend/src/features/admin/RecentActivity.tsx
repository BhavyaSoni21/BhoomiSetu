import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { AuditLogEntry } from '../../types/auditLog';

// Read-side of the audit trail (docs/FEATURE_AUDIT.md §8 item 10) - closes
// the "Integration Monitoring" half of Tech.md §38's Admin Portal ask
// alongside UserManagement's "User/Role Management" half.
const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'logged in',
  WORKFLOW_STEP_APPROVED: 'approved a workflow step',
  WORKFLOW_STEP_REJECTED: 'rejected a workflow step',
  WORKFLOW_STATUS_CHANGED: 'changed a workflow status',
  GOVERNANCE_ALERT_STATUS_CHANGED: 'updated a governance alert',
  USER_CREATED: 'created a user account',
  USER_ROLE_CHANGED: "changed a user's role",
  USER_DELETED: 'deleted a user account',
};

// Purely decorative marker dot per action family (docs/design.md's geometric-
// shape-as-wayfinding idea) - keyed off the same `action` value already used
// for ACTION_LABELS, so it needs no new data and can't drift from it.
const ACTION_DOT_CLASS: Record<string, string> = {
  AUTH_LOGIN: 'bg-primary',
  WORKFLOW_STEP_APPROVED: 'bg-primary',
  WORKFLOW_STEP_REJECTED: 'bg-secondary-strong',
  WORKFLOW_STATUS_CHANGED: 'bg-accent',
  GOVERNANCE_ALERT_STATUS_CHANGED: 'bg-accent',
  USER_CREATED: 'bg-primary',
  USER_ROLE_CHANGED: 'bg-accent',
  USER_DELETED: 'bg-secondary-strong',
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const RecentActivity: React.FC = () => {
  const { data: entries = [], isLoading, error } = useQuery<AuditLogEntry[]>(['audit-log'], async () => {
    const response = await apiService.get('/audit');
    return response.data;
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Loading activity...
      </div>
    );
  }
  if (error) return <div className="text-sm font-medium text-ink/60 py-3">Error loading activity</div>;
  if (entries.length === 0) return <div className="text-sm font-medium text-ink/60 py-3">No activity recorded yet.</div>;

  return (
    <div className="border-2 border-ink divide-y-2 divide-ink bg-surface max-h-[400px] overflow-y-auto">
      {entries.slice(0, 50).map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 px-3.5 py-3 text-sm">
          <span
            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${ACTION_DOT_CLASS[entry.action] ?? 'bg-muted'}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-ink">
              <span className="font-bold uppercase text-xs tracking-wide text-ink/70">{entry.userRole.replace(/_/g, ' ')}</span>{' '}
              {ACTION_LABELS[entry.action] ?? entry.action.toLowerCase().replace(/_/g, ' ')}
              {entry.parcelId && <span className="text-ink/60"> on parcel {entry.parcelId.substring(0, 8)}...</span>}
            </p>
            <p className="text-xs text-ink/50 mt-0.5">{formatDateTime(entry.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentActivity;
