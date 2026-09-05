import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../services/apiService';
import { Workflow } from '../types/workflow';
import { OfficerRole, ROLE_DEPARTMENT, ROLE_LABELS } from '../features/officer/officerAuth';
import { useAuthUser, useLogout } from '../features/auth/auth';
import WorkflowReviewPanel from '../features/officer/WorkflowReviewPanel';
import GovernanceAlertsPanel from '../features/officer/GovernanceAlertsPanel';
import ChangeDetectionPanel from '../features/change-detection/ChangeDetectionPanel';

function isToday(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

// Route-level RequireAuth (see App.tsx) already guarantees a signed-in
// officer before this ever mounts; `data` still starts undefined for one
// render while the shared /auth/me query resolves from cache.
const OfficerPortal: React.FC = () => {
  const { data: user } = useAuthUser();
  const logout = useLogout();

  if (!user) return null;

  const role = user.role as OfficerRole;
  return (
    <OfficerDashboard department={ROLE_DEPARTMENT[role]} name={user.name} roleLabel={ROLE_LABELS[role]} onLogout={logout} />
  );
};

interface OfficerDashboardProps {
  department: string;
  name: string;
  roleLabel: string;
  onLogout: () => void;
}

const OfficerDashboard: React.FC<OfficerDashboardProps> = ({ department, name, roleLabel, onLogout }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['officer-workflows', department],
    async () => {
      const response = await apiService.get('/workflows', { params: { department } });
      return response.data;
    },
  );

  const myStepOf = (workflow: Workflow) => workflow.steps.find((s) => s.department === department);

  const pendingWorkflows = workflows.filter((w) => myStepOf(w)?.status === 'PENDING');
  const decidedSteps = workflows.map(myStepOf).filter((s) => s && (s.status === 'APPROVED' || s.status === 'REJECTED'));
  const verifiedToday = decidedSteps.filter((s) => isToday(s!.completedAt)).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Officer Portal</h1>
          <p className="text-gray-600">Welcome, {name} ({roleLabel})</p>
        </div>
        <button onClick={onLogout} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
          Logout
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Dashboard Overview</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Pending Workflows</h3>
            <p className="text-lg font-bold">{pendingWorkflows.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Verified Today</h3>
            <p className="text-lg font-bold">{verifiedToday}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Alerts Requiring Attention</h3>
            <p className="text-lg font-bold"><GovernanceAlertsCount /></p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Documents Processed</h3>
            <p className="text-lg font-bold">{decidedSteps.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Assigned Workflows</h2>
          {isLoading ? (
            <div className="text-gray-500 text-sm">Loading workflows...</div>
          ) : error ? (
            <div className="text-gray-500 text-sm">Error loading workflows</div>
          ) : pendingWorkflows.length === 0 ? (
            <div className="text-gray-500 text-sm">No workflows currently pending your review.</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {pendingWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  className={`border rounded px-3 py-2 cursor-pointer ${
                    selectedWorkflowId === workflow.id ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium text-sm">{workflow.workflowType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">Parcel: {workflow.parcelId}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Workflow Review</h2>
          {selectedWorkflowId ? (
            <WorkflowReviewPanel workflowId={selectedWorkflowId} officerDepartment={department} />
          ) : (
            <p className="text-sm text-gray-500">Select a workflow from the list to review it.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Governance Alerts</h2>
        <GovernanceAlertsPanel />
      </div>

      <ChangeDetectionPanel />
    </div>
  );
};

// Small standalone piece so the stat card can share the exact same cached
// query (and count) that GovernanceAlertsPanel below already fetches,
// without this component needing to know the panel's internals.
const GovernanceAlertsCount: React.FC = () => {
  const { data: alerts = [] } = useQuery<unknown[]>(['governance-alerts', 'OPEN'], async () => {
    const response = await apiService.get('/governance-alerts', { params: { status: 'OPEN' } });
    return response.data;
  });
  return <>{alerts.length}</>;
};

export default OfficerPortal;
