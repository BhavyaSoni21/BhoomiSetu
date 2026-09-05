import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';

// Citizen notification MVP (docs/FEATURE_AUDIT.md §8 item 12): an in-app
// status feed on this parcel's own service requests, not real SMS/email -
// Tech.md's diagram assumes a citizen gets notified but never specifies how,
// and the Citizen Portal has no accounts to push a notification to anyway
// (see the Authentication section in README.md). Reuses the existing public
// GET /parcels/:id/workflows endpoint - no new backend route needed.

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const STATUS_MESSAGES: Record<string, string> = {
  SUBMITTED: 'has been submitted and is awaiting review',
  IN_PROGRESS: 'is under review',
  APPROVED: 'has been approved',
  REJECTED: 'has been rejected',
};

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  ROR_COPY_REQUEST: 'Record of Rights (RoR) copy request',
  CORRECTION_REQUEST: 'correction request',
  DISPUTE_FILING: 'dispute filing',
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface RequestNotificationsProps {
  parcelId: string;
}

const RequestNotifications: React.FC<RequestNotificationsProps> = ({ parcelId }) => {
  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['parcel-workflows', parcelId],
    async () => {
      const response = await apiService.get(`/parcels/${parcelId}/workflows`);
      return response.data;
    },
  );

  if (isLoading || error || workflows.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-1">Your Requests</h2>
      <p className="text-sm text-gray-500 mb-4">
        Live status for service requests filed on this parcel — no need to check back manually.
      </p>
      <div className="space-y-3">
        {workflows.map((workflow) => {
          const rejectedStep = workflow.steps.find((s) => s.status === 'REJECTED');
          const decidedSteps = workflow.steps.filter((s) => s.completedAt);
          const lastUpdated = decidedSteps
            .map((s) => s.completedAt!)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

          return (
            <div key={workflow.id} className="border rounded px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-800">
                  Your{' '}
                  <span className="font-medium">
                    {WORKFLOW_TYPE_LABELS[workflow.workflowType] ?? workflow.workflowType.replace(/_/g, ' ').toLowerCase()}
                  </span>{' '}
                  {STATUS_MESSAGES[workflow.currentStatus] ?? `is ${workflow.currentStatus.toLowerCase().replace(/_/g, ' ')}`}.
                </p>
                <span className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_COLORS[workflow.currentStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                  {workflow.currentStatus}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Reference: {workflow.id}
                {' · '}Submitted {formatDateTime(workflow.createdAt)}
                {lastUpdated && ` · Last updated ${formatDateTime(lastUpdated)}`}
              </p>
              {rejectedStep?.remarks && (
                <p className="text-xs text-red-600 mt-1">
                  Reason ({rejectedStep.department.replace(/_/g, ' ')}): {rejectedStep.remarks}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RequestNotifications;
