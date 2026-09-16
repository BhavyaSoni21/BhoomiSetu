import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AssignedVisitsPage from './verifier/AssignedVisitsPage';
import VerifierProfilePage from './verifier/VerifierProfilePage';

// Verifier Portal, mounted at /verifier/* (App.tsx, wrapped in
// RequireAuth roles={['VERIFIER']}) - same self-contained-sub-router
// pattern as OfficerPortal.tsx/CitizenPortal.tsx. Deliberately narrow: a
// Verifier's whole job is field-visit evidence capture, not department
// review, alerts, or map browsing - see docs/SIH26014_Hidden_Insights_Strategy.md
// §2 ("Verifier = evidence collector, Officer = decision authority").
const VerifierPortal: React.FC = () => (
  <div className="max-w-7xl mx-auto p-4 sm:p-6">
    <Routes>
      <Route index element={<AssignedVisitsPage />} />
      <Route path="profile" element={<VerifierProfilePage />} />
    </Routes>
  </div>
);

export default VerifierPortal;
