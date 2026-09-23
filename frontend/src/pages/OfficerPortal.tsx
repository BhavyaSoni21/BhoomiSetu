import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OfficerRole, ROLE_DEPARTMENT } from '../features/officer/officerAuth';
import { useAuthUser } from '../features/auth/auth';
import OfficerDashboardPage from './officer/OfficerDashboardPage';
import OfficerTasksPage from './officer/OfficerTasksPage';
import AssignedRequestsPage from './officer/AssignedRequestsPage';
import GovernanceAlertsPage from './officer/GovernanceAlertsPage';
import OfficerMapPage from './officer/OfficerMapPage';
import OfficerNotificationsPage from './officer/OfficerNotificationsPage';
import OfficerProfilePage from './officer/OfficerProfilePage';
import HistoricalImageryPage from './officer/HistoricalImageryPage';
import ChangeDetectionPage from './officer/ChangeDetectionPage';
import DuplicateRegistryPage from './officer/DuplicateRegistryPage';
import RegistrationChainPage from './officer/RegistrationChainPage';
import ReassessmentQueuePage from './officer/ReassessmentQueuePage';
import TaxAnalyticsPage from './officer/TaxAnalyticsPage';
import FraudPreventionPage from './officer/FraudPreventionPage';
import CertificateGeneratorPage from './officer/CertificateGeneratorPage';
import DocumentsPage from './officer/DocumentsPage';
import OfficerSlaPage from './officer/OfficerSlaPage';
import OfficerPerformancePage from './officer/OfficerPerformancePage';

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
         <Route path="tasks" element={<OfficerTasksPage />} />
         <Route path="sla" element={<OfficerSlaPage />} />
         <Route path="performance" element={<OfficerPerformancePage />} />
         <Route path="requests" element={<AssignedRequestsPage department={department} />} />
        <Route path="alerts" element={<GovernanceAlertsPage />} />
        <Route path="historical-imagery" element={<HistoricalImageryPage />} />
        <Route path="change-detection" element={<ChangeDetectionPage />} />
        <Route path="map" element={<OfficerMapPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="duplicate-registry" element={<DuplicateRegistryPage />} />
        <Route path="registration-chain" element={<RegistrationChainPage />} />
        <Route path="reassessment-queue" element={<ReassessmentQueuePage />} />
        <Route path="tax-analytics" element={<TaxAnalyticsPage />} />
        <Route path="fraud-prevention" element={<FraudPreventionPage />} />
        <Route path="certificate-generator" element={<CertificateGeneratorPage />} />
        <Route path="notifications" element={<OfficerNotificationsPage />} />
        <Route path="profile" element={<OfficerProfilePage />} />
      </Routes>
    </div>
  );
};

export default OfficerPortal;
