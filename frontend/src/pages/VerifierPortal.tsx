import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AssignedVisitsPage from './verifier/AssignedVisitsPage';
import VerifierProfilePage from './verifier/VerifierProfilePage';
import EvidenceCapturePage from '../features/verifier/EvidenceCapturePage';
import VerifierFindingsPage from '../features/verifier/VerifierFindingsPage';
import VerifierLocalSync from '../features/verifier/VerifierLocalSync';

const VerifierPortal: React.FC = () => (
  <div className="max-w-7xl mx-auto p-4 sm:p-6">
    <Routes>
      <Route index element={<AssignedVisitsPage />} />
      <Route path="profile" element={<VerifierProfilePage />} />
      <Route path="task/:taskId/evidence" element={<EvidenceCapturePage />} />
      <Route path="task/:taskId/findings" element={<VerifierFindingsPage />} />
      <Route path="local-sync" element={<VerifierLocalSync />} />
    </Routes>
  </div>
);

export default VerifierPortal;
