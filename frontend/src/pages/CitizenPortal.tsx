import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CitizenDashboardPage from './citizen/CitizenDashboardPage';
import MyParcelsPage from './citizen/MyParcelsPage';
import FindParcelsPage from './citizen/FindParcelsPage';
import RaiseRequestPage from './citizen/RaiseRequestPage';
import RequestsPage from './citizen/RequestsPage';
import VerifyDocumentsPage from './citizen/VerifyDocumentsPage';
import DocumentsPage from './citizen/DocumentsPage';
import NotificationsPage from './citizen/NotificationsPage';
import ProfilePage from './citizen/ProfilePage';

// Multi-page Citizen Portal (docs/FRONTEND_UPGRADE_SPEC.md §4), mounted once
// at /citizen/* by App.tsx (already wrapped in RequireAuth roles={['CITIZEN']}
// there) and self-contained from here down via its own relative <Routes> -
// App.tsx doesn't need to know this portal's internal page list beyond what
// navConfig.ts already declares. No nav markup here any more - every page
// below is reachable from the single global navbar in App.tsx instead (the
// user's explicit "i dont want 2 diffrent navbars").
const CitizenPortal: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <Routes>
      <Route index element={<CitizenDashboardPage />} />
      <Route path="parcels" element={<MyParcelsPage />} />
      <Route path="find" element={<FindParcelsPage />} />
      <Route path="raise-request" element={<RaiseRequestPage />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="verify" element={<VerifyDocumentsPage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Routes>
  </div>
);

export default CitizenPortal;
