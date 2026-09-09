import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, History, BarChart3, ShieldAlert, Workflow, MapPinned, Clock } from 'lucide-react';
import AnalyticsDashboard from '../../features/analytics/AnalyticsDashboard';
import TopRiskParcels from '../../features/analytics/TopRiskParcels';
import UserManagement from '../../features/admin/UserManagement';
import CornerMarker from '../../features/admin/CornerMarker';
import { useAuthUser } from '../../features/auth/auth';

// Multi-page Admin Portal (docs/FRONTEND_UPGRADE_SPEC.md §7, Phase 3),
// mounted at /admin/* by AdminPortal.tsx - same pattern as
// OfficerPortal.tsx/CitizenPortal.tsx. No page-level "Admin Portal"
// heading or Logout button any more - the global navbar (App.tsx) already
// names the portal and provides Sign Out, matching the convention the
// Officer/Citizen Dashboard pages already follow. System Overview
// (Total Users/Logins/System Status/Last Backup) and Recent Activity moved
// to their own System Monitoring page - this Dashboard keeps only the
// day-to-day admin actions (user management, analytics, risk).
//
// Route-level RequireAuth (see App.tsx) already guarantees a signed-in
// admin before this ever mounts; `user` still starts undefined for one
// render while the shared /auth/me query resolves from cache.
const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">Welcome, {user.name}</h1>
        <p className="text-ink/60 mt-1">This portal is for system administration, user management, and configuration.</p>
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
      <div className="flex items-center gap-2 text-ink/40 text-xs pt-6">
        <History className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Recent activity and system health moved to the System Monitoring page.</span>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
