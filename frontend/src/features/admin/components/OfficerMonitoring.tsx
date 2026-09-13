import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import apiService from '../../../services/apiService';
import { OfficerMonitoringEntry } from '../../types/analytics';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatHours(value: number | null): string {
  if (value === null) return '—';
  return value < 1 ? '< 1h' : `${value}h`;
}

// "Officer monitoring - how officers handle citizen issues"
// (docs/ADMIN_PANEL_ISSUES.md Admin #4). Table styling mirrors
// RecentActivity.tsx's bordered-list convention. pendingInRoleQueue is
// explicitly labeled "in queue" rather than "assigned to them" - WorkflowStep
// has no per-user assignee, only a role, which every officer holding that
// role shares (see backend/src/analytics/analytics.service.ts's own comment).
const OfficerMonitoring: React.FC = () => {
  const { t } = useTranslation();
  const { data: entries = [], isLoading, error } = useQuery<OfficerMonitoringEntry[]>(
    ['officer-monitoring'],
    async () => (await apiService.get('/analytics/officer-monitoring')).data,
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {t('adminPortal.loadingOfficerMonitoring')}
      </div>
    );
  }
  if (error) return <div className="text-sm font-medium text-ink/60 py-3">{t('adminPortal.errorLoadingOfficerMonitoring')}</div>;
  if (entries.length === 0) return <div className="text-sm font-medium text-ink/60 py-3">{t('adminPortal.noOfficersFound')}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-2 border-ink">
        <thead>
          <tr className="bg-muted border-b-2 border-ink text-left">
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/70">{t('adminPortal.officerColumn')}</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/70">{t('adminPortal.departmentColumn')}</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/70 text-right">{t('adminPortal.pendingInQueueColumn')}</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/70 text-right">{t('adminPortal.approvedColumn')}</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/70 text-right">{t('adminPortal.rejectedColumn')}</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/70 text-right">{t('adminPortal.avgDecisionTimeColumn')}</th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/70">{t('adminPortal.lastActivityColumn')}</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-ink/10">
          {entries.map((entry) => (
            <tr key={entry.userId}>
              <td className="px-3 py-2.5 font-bold text-ink">{entry.name}</td>
              <td className="px-3 py-2.5 text-ink/70">{entry.department.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2.5 text-right text-ink">{entry.pendingInRoleQueue}</td>
              <td className="px-3 py-2.5 text-right text-primary font-bold">{entry.approvedCount}</td>
              <td className="px-3 py-2.5 text-right text-secondary-strong font-bold">{entry.rejectedCount}</td>
              <td className="px-3 py-2.5 text-right text-ink/70">{formatHours(entry.avgDecisionHours)}</td>
              <td className="px-3 py-2.5 text-ink/60 text-xs">{formatDateTime(entry.lastActivityAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-ink/50 mt-2">{t('adminPortal.pendingInQueueNote')}</p>
    </div>
  );
};

export default OfficerMonitoring;
