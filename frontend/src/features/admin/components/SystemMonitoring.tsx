import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Users, LogIn, Clock, Activity } from 'lucide-react';
import apiService from '../../../services/apiService';
import { AnalyticsSummary } from '../../types/analytics';
import RecentActivity from './RecentActivity';

// System Monitoring (docs/FRONTEND_UPGRADE_SPEC.md §7, Phase 3) - "the most
// tractable of the four [Admin Portal pieces] - this can genuinely reuse
// GET /analytics/summary and GET /audit, just presented as its own page
// rather than cards sharing space with User Management." Moved here
// verbatim from AdminPortal's old single-page "System Overview" cards plus
// the Recent Activity feed, which now gets its own full page instead of a
// capped 50-entry box.
const SystemMonitoring: React.FC = () => {
  const { t } = useTranslation();
  const { data: summary } = useQuery<AnalyticsSummary>(['analytics-summary'], async () => {
    const response = await apiService.get('/analytics/summary');
    return response.data;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">{t('adminPortal.totalUsersLabel')}</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{summary?.totals.totalUsers ?? '—'}</p>
        </div>
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <LogIn className="w-4 h-4 text-primary" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">{t('adminPortal.logins24hLabel')}</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{summary?.totals.recentLogins24h ?? '—'}</p>
        </div>
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">{t('adminPortal.systemStatusLabel')}</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{t('adminPortal.systemStatusOnline')}</p>
        </div>
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-secondary" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">{t('adminPortal.lastBackupLabel')}</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{t('adminPortal.lastBackupNever')}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink">{t('adminPortal.activityLogHeading')}</h2>
        </div>
        <p className="text-sm text-ink/60 mb-4">{t('adminPortal.activityLogDesc')}</p>
        <RecentActivity />
      </div>
    </div>
  );
};

export default SystemMonitoring;
