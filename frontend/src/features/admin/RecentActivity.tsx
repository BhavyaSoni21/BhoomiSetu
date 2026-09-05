import React from 'react';
import { useQuery } from '@tanstack/react-query';
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

  if (isLoading) return <div className="text-gray-500 text-sm">Loading activity...</div>;
  if (error) return <div className="text-gray-500 text-sm">Error loading activity</div>;
  if (entries.length === 0) return <div className="text-gray-500 text-sm">No activity recorded yet.</div>;

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {entries.slice(0, 50).map((entry) => (
        <div key={entry.id} className="text-sm border-b py-2 last:border-b-0">
          <p className="text-gray-700">
            <span className="font-medium">{entry.userRole.replace(/_/g, ' ')}</span>{' '}
            {ACTION_LABELS[entry.action] ?? entry.action.toLowerCase().replace(/_/g, ' ')}
            {entry.parcelId && <span className="text-gray-500"> on parcel {entry.parcelId.substring(0, 8)}...</span>}
          </p>
          <p className="text-xs text-gray-400">{formatDateTime(entry.createdAt)}</p>
        </div>
      ))}
    </div>
  );
};

export default RecentActivity;
