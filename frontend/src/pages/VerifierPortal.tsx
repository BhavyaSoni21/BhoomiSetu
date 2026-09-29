import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AssignedVisitsPage from './verifier/AssignedVisitsPage';
import VerifierProfilePage from './verifier/VerifierProfilePage';
import TaskSubmissionPage from '../features/verifier/TaskSubmissionPage';
import VerifierLocalSync from '../features/verifier/VerifierLocalSync';

const VerifierPortal: React.FC = () => (
  <div className="max-w-7xl mx-auto p-4 sm:p-6">
    <Routes>
      <Route index element={<AssignedVisitsPage />} />
      <Route path="profile" element={<VerifierProfilePage />} />
      <Route path="task/:taskId/submit" element={<TaskSubmissionPage />} />
      {/* Legacy split routes now redirect to the unified submit page - the old
          Capture Evidence / Submit Findings pages dropped photo bytes and
          mis-keyed the case id, so bookmarks land on the working flow instead. */}
      <Route path="task/:taskId/evidence" element={<Navigate to="../submit" replace />} />
      <Route path="task/:taskId/findings" element={<Navigate to="../submit" replace />} />
      <Route path="local-sync" element={<VerifierLocalSync />} />
    </Routes>
  </div>
);

export default VerifierPortal;
