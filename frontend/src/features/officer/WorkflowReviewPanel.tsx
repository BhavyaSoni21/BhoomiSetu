import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X as XIcon, AlertCircle } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';

interface WorkflowReviewPanelProps {
  workflowId: string;
  officerDepartment: string;
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN');
}

// Status semantics win over the portal's role color here (docs/design.md):
// approved -> primary (green), rejected -> secondary (terracotta),
// anything still in flight (pending/submitted/in-progress) -> accent (gold).
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-accent text-ink',
  SUBMITTED: 'bg-accent text-ink',
  IN_PROGRESS: 'bg-accent text-ink',
  APPROVED: 'bg-primary text-white',
  REJECTED: 'bg-secondary text-white',
};

const statusBadgeClass = (status: string) =>
  `inline-block border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLES[status] ?? 'bg-muted text-ink'}`;

const WorkflowReviewPanel: React.FC<WorkflowReviewPanelProps> = ({ workflowId, officerDepartment }) => {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  const { data: workflow, isLoading, error } = useQuery<Workflow>(
    ['workflow', workflowId],
    async () => {
      const response = await apiService.get(`/workflows/${workflowId}`);
      return response.data;
    },
  );

  const reviewMutation = useMutation(
    async (action: 'APPROVE' | 'REJECT') => {
      const myStep = workflow!.steps.find((s) => s.department === officerDepartment);
      const response = await apiService.patch(`/workflows/${workflowId}/steps/${myStep!.id}`, {
        action,
        remarks: remarks.trim() || undefined,
      });
      return response.data as Workflow;
    },
    {
      onSuccess: () => {
        setRemarks('');
        queryClient.invalidateQueries(['workflow', workflowId]);
        queryClient.invalidateQueries(['officer-workflows']);
      },
    },
  );

  if (isLoading) return <div className="text-ink/60 text-sm">Loading workflow...</div>;
  if (error || !workflow) return <div className="text-ink/60 text-sm">Error loading workflow</div>;

  const myStep = workflow.steps.find((s) => s.department === officerDepartment);
  const canReview = myStep?.status === 'PENDING';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{workflow.workflowType.replace(/_/g, ' ')}</h3>
        <p className="text-sm text-ink/60">Parcel: {workflow.parcelId}</p>
        <span className={`mt-1 ${statusBadgeClass(workflow.currentStatus)}`}>
          {workflow.currentStatus}
        </span>
        {workflow.requestDetails && <p className="text-sm text-ink/70 mt-2 italic">&quot;{workflow.requestDetails}&quot;</p>}
      </div>

      <div className="space-y-2">
        <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70">Review Steps</h4>
        <div className="border-2 border-ink divide-y-2 divide-ink">
          {workflow.steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm bg-surface">
              <div>
                <span className="font-bold text-ink">{step.department.replace(/_/g, ' ')}</span>
                <span className="text-ink/60"> ({step.assignedRole.replace(/_/g, ' ')})</span>
                {step.remarks && <p className="text-ink/60 text-xs mt-0.5">Remarks: {step.remarks}</p>}
                {step.completedAt && <p className="text-ink/50 text-xs">Decided: {formatDate(step.completedAt)}</p>}
              </div>
              <span className={statusBadgeClass(step.status)}>
                {step.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {canReview ? (
        <div className="border-t-4 border-ink pt-4">
          <label htmlFor="review-remarks" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
            Remarks (optional)
          </label>
          <textarea
            id="review-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink focus:outline-none focus:border-primary"
            rows={3}
            placeholder="Add remarks for this decision..."
          />
          {reviewMutation.isError && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong mt-1">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              Something went wrong submitting your decision. Please try again.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => reviewMutation.mutate('APPROVE')}
              disabled={reviewMutation.isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              Approve
            </button>
            <button
              onClick={() => reviewMutation.mutate('REJECT')}
              disabled={reviewMutation.isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <XIcon className="w-4 h-4" aria-hidden="true" />
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink/60 border-t-4 border-ink pt-4">
          {myStep ? 'Your department has already decided this step.' : 'No step in this workflow is assigned to your department.'}
        </p>
      )}
    </div>
  );
};

export default WorkflowReviewPanel;
