import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-gray-100 text-gray-700',
};

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

  if (isLoading) return <div className="text-gray-500 text-sm">Loading workflow...</div>;
  if (error || !workflow) return <div className="text-gray-500 text-sm">Error loading workflow</div>;

  const myStep = workflow.steps.find((s) => s.department === officerDepartment);
  const canReview = myStep?.status === 'PENDING';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{workflow.workflowType.replace(/_/g, ' ')}</h3>
        <p className="text-sm text-gray-500">Parcel: {workflow.parcelId}</p>
        <span className={`inline-block mt-1 rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[workflow.currentStatus] ?? 'bg-gray-100 text-gray-700'}`}>
          {workflow.currentStatus}
        </span>
        {workflow.requestDetails && <p className="text-sm text-gray-600 mt-2">"{workflow.requestDetails}"</p>}
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm text-gray-700">Review Steps</h4>
        {workflow.steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
            <div>
              <span className="font-medium">{step.department.replace(/_/g, ' ')}</span>
              <span className="text-gray-500"> ({step.assignedRole.replace(/_/g, ' ')})</span>
              {step.remarks && <p className="text-gray-500 text-xs mt-0.5">Remarks: {step.remarks}</p>}
              {step.completedAt && <p className="text-gray-400 text-xs">Decided: {formatDate(step.completedAt)}</p>}
            </div>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[step.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {step.status}
            </span>
          </div>
        ))}
      </div>

      {canReview ? (
        <div className="border-t pt-4">
          <label htmlFor="review-remarks" className="block text-sm font-medium text-gray-700 mb-1">
            Remarks (optional)
          </label>
          <textarea
            id="review-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Add remarks for this decision..."
          />
          {reviewMutation.isError && (
            <p className="text-sm text-red-600 mt-1">Something went wrong submitting your decision. Please try again.</p>
          )}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => reviewMutation.mutate('APPROVE')}
              disabled={reviewMutation.isLoading}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => reviewMutation.mutate('REJECT')}
              disabled={reviewMutation.isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 border-t pt-4">
          {myStep ? 'Your department has already decided this step.' : 'No step in this workflow is assigned to your department.'}
        </p>
      )}
    </div>
  );
};

export default WorkflowReviewPanel;
