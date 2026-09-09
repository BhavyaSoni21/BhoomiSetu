import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, History, BarChart3, ShieldAlert } from 'lucide-react';
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
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">{t('adminPortal.dashboardWelcome', { name: user.name })}</h1>
        <p className="text-ink/60 mt-1">{t('adminPortal.dashboardSubtitle')}</p>
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">{t('adminPortal.userManagementHeading')}</h2>
        </div>
        <p className="text-sm text-ink/60 mb-4">{t('adminPortal.userManagementDesc')}</p>
        <UserManagement />
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">{t('adminPortal.governanceAnalyticsHeading')}</h2>
        </div>
        <AnalyticsDashboard />
      </div>

      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <CornerMarker />
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-black uppercase tracking-tight font-display text-ink">{t('adminPortal.topRiskParcelsHeading')}</h2>
        </div>
        <p className="text-sm text-ink/60 mb-4">
          {t('adminPortal.topRiskParcelsDesc')}
        </p>
        <TopRiskParcels />
      </div>

      {/* Both Coming Soon placeholders that used to live here (Workflow
          Oversight, Map Layer Authoring) are real pages now, reachable from
          the nav ("Workflows", "Map Layer Authoring") - matching how
          Departments/System Monitoring are nav-only with no dashboard card,
          this section was removed entirely rather than left empty. */}
      <div className="flex items-center gap-2 text-ink/40 text-xs pt-6">
        <History className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{t('adminPortal.movedToSystemMonitoring')}</span>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
