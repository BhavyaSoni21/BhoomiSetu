import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Triangle, LogOut, LogIn, Users, History, BarChart3, ShieldAlert, Workflow, MapPinned, Clock } from 'lucide-react';
import apiService from '../services/apiService';
import AnalyticsDashboard from '../features/analytics/AnalyticsDashboard';
import TopRiskParcels from '../features/analytics/TopRiskParcels';
import UserManagement from '../features/admin/UserManagement';
import RecentActivity from '../features/admin/RecentActivity';
import { useAuthUser, useLogout } from '../features/auth/auth';
import { AnalyticsSummary } from '../types/analytics';

// Admin = triangle + gold (docs/design.md §2 role mapping) - the small
// corner marker repeated on every card below, echoing the same wayfinding
// shape the app switcher/nav already use for this portal.
const CornerMarker: React.FC = () => (
  <span
    className="absolute -top-3 -right-3 w-7 h-7 bg-accent border-2 border-ink flex items-center justify-center shadow-hard-sm"
    aria-hidden="true"
  >
    <Triangle className="w-3.5 h-3.5 fill-ink text-ink" />
  </span>
);

// Route-level RequireAuth (see App.tsx) already guarantees a signed-in admin
// before this ever mounts; `data` still starts undefined for one render
// while the shared /auth/me query resolves from cache.
const AdminPortal: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  const logout = useLogout();

  // Same query key AnalyticsDashboard uses internally - React Query shares
  // the cache/request rather than firing two calls for the same data.
  const { data: summary } = useQuery<AnalyticsSummary>(
    ['analytics-summary'],
    async () => {
      const response = await apiService.get('/analytics/summary');
      return response.data;
    },
    { enabled: !!user },
  );

  if (!user) return null;

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-ink pb-6">
        <div className="flex items-start gap-3.5">
          <span className="hidden sm:flex w-11 h-11 bg-accent/20 border-2 border-accent items-center justify-center shrink-0" aria-hidden="true">
            <Triangle className="w-5 h-5 fill-accent text-ink" />
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">Admin Portal</h1>
            <p className="text-ink/70 mt-1 leading-relaxed max-w-2xl">
              Welcome, {user.name}. This portal is for system administration, user management, and configuration.
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 border-2 border-ink bg-surface text-ink px-4 py-2.5 text-sm font-bold uppercase tracking-wider shadow-hard-sm transition hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Logout
        </button>
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink mb-4">System Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="border-2 border-ink bg-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">Total Users</h3>
            </div>
            <p className="text-2xl font-black font-display text-ink">{summary?.totals.totalUsers ?? '—'}</p>
          </div>
          <div className="border-2 border-ink bg-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <LogIn className="w-4 h-4 text-primary" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">Logins (24h)</h3>
            </div>
            <p className="text-2xl font-black font-display text-ink">{summary?.totals.recentLogins24h ?? '—'}</p>
          </div>
          <div className="border-2 border-ink bg-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">System Status</h3>
            </div>
            <p className="text-2xl font-black font-display text-ink">Online</p>
          </div>
          <div className="border-2 border-ink bg-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-secondary" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">Last Backup</h3>
            </div>
            <p className="text-2xl font-black font-display text-ink">Never</p>
          </div>
        </div>
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">User Management</h2>
        </div>
        <p className="text-sm text-ink/60 mb-4">Create, promote/demote, and remove Officer and Admin accounts.</p>
        <UserManagement />
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-1">
          <History className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">Recent Activity</h2>
        </div>
        <p className="text-sm text-ink/60 mb-4">A live audit trail of officer/admin logins and decisions across the platform.</p>
        <RecentActivity />
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">Governance Analytics</h2>
        </div>
        <AnalyticsDashboard />
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">Top At-Risk Parcels</h2>
        </div>
        <p className="text-sm text-ink/60 mb-4">
          Ranked by a heuristic risk score combining tax, dispute, governance-alert, and restriction signals.
        </p>
        <TopRiskParcels />
      </div>

      {/* Placeholder cards (docs/flow.md §6/§7, rule 8): real RBAC/API
          capability exists server-side but there is no Admin-facing UI yet.
          Deliberately smaller/lower-contrast than the Built cards above -
          dashed border, no hard shadow, reduced-opacity content, disabled
          controls, no data fetched - so they read as "not live yet" without
          looking broken. */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink/50 mb-3">{t('admin.upcomingHeading')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative border-2 border-dashed border-ink/40 bg-surface/60 p-5 opacity-75">
            <span className="absolute top-4 right-4 inline-flex items-center gap-1 bg-accent text-ink border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {t('admin.comingSoonBadge')}
            </span>
            <div className="flex items-center gap-2 mb-2 pr-28">
              <Workflow className="w-5 h-5 text-ink/50" aria-hidden="true" />
              <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink/70">
                {t('admin.workflowOversightTitle')}
              </h3>
            </div>
            <p className="text-sm text-ink/50 leading-relaxed mb-3">{t('admin.workflowOversightDesc')}</p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="pointer-events-none inline-flex items-center gap-2 border-2 border-ink/30 bg-muted/60 text-ink/40 px-3.5 py-2 text-xs font-bold uppercase tracking-wider"
            >
              {t('admin.reviewWorkflowsCta')}
            </button>
          </div>

          <div className="relative border-2 border-dashed border-ink/40 bg-surface/60 p-5 opacity-75">
            <span className="absolute top-4 right-4 inline-flex items-center gap-1 bg-accent text-ink border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
              <Clock className="w-3 h-3" aria-hidden="true" />
              {t('admin.comingSoonBadge')}
            </span>
            <div className="flex items-center gap-2 mb-2 pr-28">
              <MapPinned className="w-5 h-5 text-ink/50" aria-hidden="true" />
              <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink/70">
                {t('admin.mapLayerAuthoringTitle')}
              </h3>
            </div>
            <p className="text-sm text-ink/50 leading-relaxed mb-3">{t('admin.mapLayerAuthoringDesc')}</p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="pointer-events-none inline-flex items-center gap-2 border-2 border-ink/30 bg-muted/60 text-ink/40 px-3.5 py-2 text-xs font-bold uppercase tracking-wider"
            >
              {t('admin.manageLayersCta')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortal;
