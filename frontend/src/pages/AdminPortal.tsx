import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthUser } from '../features/auth/auth';
import AdminDashboardPage from './admin/AdminDashboardPage';
import AdminDepartmentsPage from './admin/AdminDepartmentsPage';
import SystemMonitoringPage from './admin/SystemMonitoringPage';

// Multi-page Admin Portal (docs/FRONTEND_UPGRADE_SPEC.md §7, Phase 3),
// mounted once at /admin/* by App.tsx (already wrapped in RequireAuth
// roles={['ADMIN']} there) and self-contained from here down via its own
// relative <Routes> - same pattern as OfficerPortal.tsx/CitizenPortal.tsx.
// No nav markup or "Welcome"/Logout header here any more - every page is
// reachable from the single global navbar in App.tsx instead, matching the
// Officer/Citizen Portal precedent this finally extends to Admin.
//
// Route-level RequireAuth (see App.tsx) already guarantees a signed-in
// admin before this ever mounts; `user` still starts undefined for one
// render while the shared /auth/me query resolves from cache.
const AdminPortal: React.FC = () => {
  const { data: user } = useAuthUser();
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <Routes>
        <Route index element={<AdminDashboardPage />} />
        <Route path="departments" element={<AdminDepartmentsPage />} />
        <Route path="system-monitoring" element={<SystemMonitoringPage />} />
      </Routes>
    </div>
  );
};

export default AdminPortal;
