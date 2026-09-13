import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ShieldCheck, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../../services/apiService';
import { AuditLogEntry } from '../../../types/auditLog';

interface AdminActivitySummaryProps {
  onViewLogClick?: () => void;
}

const AdminActivitySummary: React.FC<AdminActivitySummaryProps> = ({ onViewLogClick }) => {
  const { t } = useTranslation();
  const { data: entries = [], isLoading } = useQuery<AuditLogEntry[]>(['admin-activity-summary'], async () => {
    const response = await apiService.get('/admin/activity-summary');
    return response.data;
  });

  const recentEntries = isLoading ? [] : (entries || []).slice(0, 5);

  const actionLabels: Record<string, string> = {
    permissionApproved: 'Permission Approved',
    roleChanged: 'Role Changed',
    userAccountUpdated: 'User Account Updated',
    accessRequestApproved: 'Access Request Approved',
    configurationChanged: 'Configuration Changed',
  };

  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">Administrative Activity</h3>
        </div>
      </div>
      <div className="p-6">
        {isLoading ? (
          <p className="text-sm text-ink/60">Loading activity...</p>
        ) : recentEntries.length === 0 ? (
          <p className="text-sm text-ink/60">No activity recorded</p>
        ) : (
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
            {recentEntries.map((entry) => {
              const label = actionLabels[entry.action] || entry.action.replace(/_/g, ' ').replace(/\b\w/g, (character: string) => character.toUpperCase());
              return (
                <div key={entry.id} className="flex items-start gap-3 px-3 py-2 border-b border-ink/20 last:border-0">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink font-medium text-xs uppercase tracking-wider">
                      {label}
                    </p>
                    <p className="text-xs text-ink/50 mt-0.5">
                      {entry.createdAt}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="p-6 border-t border-ink/20">
        <button
          type="button"
          onClick={onViewLogClick}
          className="w-full inline-flex items-center justify-center gap-2 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          View Audit Log
        </button>
      </div>
    </div>
  );
};

export default AdminActivitySummary;