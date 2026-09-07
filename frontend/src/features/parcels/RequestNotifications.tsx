import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';

// Citizen notification MVP (docs/FEATURE_AUDIT.md §8 item 12): an in-app
// status feed on this parcel's own service requests, not real SMS/email -
// Tech.md's diagram assumes a citizen gets notified but never specifies how,
// and the Citizen Portal has no accounts to push a notification to anyway
// (see the Authentication section in README.md). Reuses the existing public
// GET /parcels/:id/workflows endpoint - no new backend route needed.

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-muted text-ink/70 border-ink/20',
  IN_PROGRESS: 'bg-primary/10 text-primary border-primary/40',
  APPROVED: 'bg-primary/15 text-primary border-primary/50',
  REJECTED: 'bg-secondary/15 text-secondary-strong border-secondary/50',
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
    <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
      <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink flex items-center justify-center" aria-hidden="true">
        <Inbox className="w-3.5 h-3.5 text-white" />
      </span>
      <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-1">Your Requests</h2>
      <p className="text-sm text-ink/60 mb-4 leading-relaxed">
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
            <div key={workflow.id} className="border-2 border-ink/15 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink/80">
                  Your{' '}
                  <span className="font-bold text-ink">
                    {WORKFLOW_TYPE_LABELS[workflow.workflowType] ?? workflow.workflowType.replace(/_/g, ' ').toLowerCase()}
                  </span>{' '}
                  {STATUS_MESSAGES[workflow.currentStatus] ?? `is ${workflow.currentStatus.toLowerCase().replace(/_/g, ' ')}`}.
                </p>
                <span className={`border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${STATUS_COLORS[workflow.currentStatus] ?? 'bg-muted text-ink/70 border-ink/20'}`}>
                  {workflow.currentStatus}
                </span>
              </div>
              <p className="text-xs text-ink/40 mt-1">
                Reference: {workflow.id}
                {' · '}Submitted {formatDateTime(workflow.createdAt)}
                {lastUpdated && ` · Last updated ${formatDateTime(lastUpdated)}`}
              </p>
              {rejectedStep?.remarks && (
                <p className="text-xs text-secondary-strong mt-1">
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
