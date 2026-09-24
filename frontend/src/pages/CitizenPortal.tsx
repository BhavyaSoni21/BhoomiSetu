import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import CitizenDashboardPage from './citizen/CitizenDashboardPage';
import MyParcelsPage from './citizen/MyParcelsPage';
import FindParcelsPage from './citizen/FindParcelsPage';
import GetAssistancePage from './citizen/GetAssistancePage';
import MyCasesPage from './citizen/MyCasesPage';
import NotificationsPage from './citizen/NotificationsPage';
import ProfilePage from './citizen/ProfilePage';

// Multi-page Citizen Portal (docs/FRONTEND_UPGRADE_SPEC.md §4), mounted once
// at /citizen/* by App.tsx (already wrapped in RequireAuth roles={['CITIZEN']}
// there) and self-contained from here down via its own relative <Routes> -
// App.tsx doesn't need to know this portal's internal page list beyond what
// navConfig.ts already declares. No nav markup here any more - every page
// below is reachable from the single global navbar in App.tsx instead (the
// user's explicit "i dont want 2 diffrent navbars").
//
// Consolidated 2026-09-23: "Raise Request" (legacy structured form) folded
// into "Get Assistance" (the AI-assisted §3 entry point), and the old
// workflow-based "Requests" list folded into "My Cases" (the go-forward
// case model per spec §65). Old routes redirect so bookmarks/inbound links
// still resolve. `documents`/`verify` were folded earlier (documents → a
// Profile tab; verify → the assistance flow).
// Preserve the query string across a legacy-route redirect so e.g.
// /citizen/raise-request?parcelId=X lands on get-assistance still carrying
// parcelId (a plain <Navigate to="..."> would drop it).
const RedirectPreserveQuery: React.FC<{ to: string }> = ({ to }) => {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
};

const CitizenPortal: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <Routes>
      <Route index element={<CitizenDashboardPage />} />
      <Route path="parcels" element={<MyParcelsPage />} />
      <Route path="find" element={<FindParcelsPage />} />
      <Route path="get-assistance" element={<GetAssistancePage />} />
      <Route path="my-cases" element={<MyCasesPage />} />
      <Route path="raise-request" element={<RedirectPreserveQuery to="/citizen/get-assistance" />} />
      <Route path="requests" element={<Navigate to="/citizen/my-cases" replace />} />
      <Route path="verify" element={<Navigate to="/citizen/get-assistance" replace />} />
      <Route path="documents" element={<Navigate to="/citizen/profile?tab=documents" replace />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Routes>
  </div>
);

export default CitizenPortal;
