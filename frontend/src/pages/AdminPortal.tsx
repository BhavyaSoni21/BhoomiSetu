import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../services/apiService';
import AnalyticsDashboard from '../features/analytics/AnalyticsDashboard';
import TopRiskParcels from '../features/analytics/TopRiskParcels';
import UserManagement from '../features/admin/UserManagement';
import RecentActivity from '../features/admin/RecentActivity';
import { useAuthUser, useLogout } from '../features/auth/auth';
import { AnalyticsSummary } from '../types/analytics';

// Route-level RequireAuth (see App.tsx) already guarantees a signed-in admin
// before this ever mounts; `data` still starts undefined for one render
// while the shared /auth/me query resolves from cache.
const AdminPortal: React.FC = () => {
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
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin Portal</h1>
          <p className="text-gray-600">Welcome, {user.name}. This portal is for system administration, user management, and configuration.</p>
        </div>
        <button onClick={logout} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
          Logout
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">System Overview</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Total Users</h3>
            <p className="text-lg font-bold">{summary?.totals.totalUsers ?? '—'}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Logins (24h)</h3>
            <p className="text-lg font-bold">{summary?.totals.recentLogins24h ?? '—'}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">System Status</h3>
            <p className="text-lg font-bold">Online</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Last Backup</h3>
            <p className="text-lg font-bold">Never</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-1">User Management</h2>
        <p className="text-sm text-gray-500 mb-4">Create, promote/demote, and remove Officer and Admin accounts.</p>
        <UserManagement />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-1">Recent Activity</h2>
        <p className="text-sm text-gray-500 mb-4">A live audit trail of officer/admin logins and decisions across the platform.</p>
        <RecentActivity />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Governance Analytics</h2>
        <AnalyticsDashboard />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-1">Top At-Risk Parcels</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ranked by a heuristic risk score combining tax, dispute, governance-alert, and restriction signals.
        </p>
        <TopRiskParcels />
      </div>
    </div>
  );
};

export default AdminPortal;
