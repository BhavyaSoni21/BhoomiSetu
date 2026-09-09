import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CitizenDashboardPage from './citizen/CitizenDashboardPage';
import MyParcelsPage from './citizen/MyParcelsPage';
import FindParcelsPage from './citizen/FindParcelsPage';
import RaiseRequestPage from './citizen/RaiseRequestPage';
import RequestsPage from './citizen/RequestsPage';
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
// `documents`/`verify` used to be their own top-level pages - `documents`
// moved into Profile as a tab 2026-09-09 (the user's follow-up: "documents
// tabs should also be part of profile"); `verify` was later folded into
// Raise Request entirely (a Verify Documents request against an
// already-linked parcel, not a standalone instant-verify feature) - see
// docs/FRONTEND_UPGRADE_SPEC.md follow-up. Old links/bookmarks redirect
// instead of 404ing.
const CitizenPortal: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <Routes>
      <Route index element={<CitizenDashboardPage />} />
      <Route path="parcels" element={<MyParcelsPage />} />
      <Route path="find" element={<FindParcelsPage />} />
      <Route path="raise-request" element={<RaiseRequestPage />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="verify" element={<Navigate to="/citizen/raise-request" replace />} />
      <Route path="documents" element={<Navigate to="/citizen/profile?tab=documents" replace />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Routes>
  </div>
);

export default CitizenPortal;
