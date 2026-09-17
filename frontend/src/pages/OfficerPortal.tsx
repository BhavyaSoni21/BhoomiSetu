import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OfficerRole, ROLE_DEPARTMENT } from '../features/officer/officerAuth';
import { useAuthUser } from '../features/auth/auth';
import OfficerDashboardPage from './officer/OfficerDashboardPage';
import AssignedRequestsPage from './officer/AssignedRequestsPage';
import GovernanceAlertsPage from './officer/GovernanceAlertsPage';
import OfficerMapPage from './officer/OfficerMapPage';
import OfficerNotificationsPage from './officer/OfficerNotificationsPage';
import OfficerProfilePage from './officer/OfficerProfilePage';
import HistoricalImageryPage from './officer/HistoricalImageryPage';
import ChangeDetectionPage from './officer/ChangeDetectionPage';

// Multi-page Officer Portal (docs/FRONTEND_UPGRADE_SPEC.md §5), mounted once
// at /officer/* by App.tsx (already wrapped in RequireAuth roles={OFFICER_ROLES}
// there) and self-contained from here down via its own relative <Routes> -
// same pattern as CitizenPortal.tsx. No nav markup or "Welcome"/Logout header
// here any more - every page is reachable from the single global navbar in
// App.tsx instead (the user's explicit "i dont want 2 diffrent navbars"),
// "Welcome, {name}" moved to OfficerDashboardPage.tsx, and Logout is the
// existing "Sign Out" control in App.tsx's own utility bar.
//
// Route-level RequireAuth (see App.tsx) already guarantees a signed-in
// officer before this ever mounts; `user` still starts undefined for one
// render while the shared /auth/me query resolves from cache.
const OfficerPortal: React.FC = () => {
  const { data: user } = useAuthUser();
  if (!user) return null;

  const department = ROLE_DEPARTMENT[user.role as OfficerRole];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <Routes>
        <Route index element={<OfficerDashboardPage department={department} />} />
        <Route path="requests" element={<AssignedRequestsPage department={department} />} />
        <Route path="alerts" element={<GovernanceAlertsPage />} />
        <Route path="historical-imagery" element={<HistoricalImageryPage />} />
        <Route path="change-detection" element={<ChangeDetectionPage />} />
        <Route path="map" element={<OfficerMapPage />} />
        {/* Documents merged into Assigned Requests 2026-09-10 (docs/ADMIN_PANEL_ISSUES.md
            follow-up, per the user's explicit "the documents should be the
            part of... Assigned Requests") - old links/bookmarks redirect,
            same precedent as CitizenPortal.tsx's own redirected routes. */}
        <Route path="documents" element={<Navigate to="/officer/requests" replace />} />
        <Route path="notifications" element={<OfficerNotificationsPage />} />
        <Route path="profile" element={<OfficerProfilePage />} />
      </Routes>
    </div>
  );
};

export default OfficerPortal;
