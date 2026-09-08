import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Eye } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';
import WorkflowReviewPanel from '../../features/officer/WorkflowReviewPanel';

interface AssignedRequestsPageProps {
  department: string;
}

const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

// Request ID, parcel, type, status, per-row -> review detail
// (docs/FRONTEND_UPGRADE_SPEC.md §5) - the two-column workflow-list +
// review-panel section that used to live directly on OfficerPortal's single
// dashboard, now its own page. Uses the same ('officer-workflows', department)
// query key the Dashboard's stat cards use, so navigating between them
// doesn't re-fetch.
const AssignedRequestsPage: React.FC<AssignedRequestsPageProps> = ({ department }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['officer-workflows', department],
    async () => (await apiService.get('/workflows', { params: { department } })).data,
  );

  const myStepOf = (workflow: Workflow) => workflow.steps.find((s) => s.department === department);
  const pendingWorkflows = workflows.filter((w) => myStepOf(w)?.status === 'PENDING');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <h2 className={sectionHeadingClass}>
          <ClipboardList className="w-5 h-5 text-secondary" aria-hidden="true" />
          Assigned Workflows
        </h2>
        {isLoading ? (
          <div className="text-ink/60 text-sm">Loading workflows...</div>
        ) : error ? (
          <div className="text-ink/60 text-sm">Error loading workflows</div>
        ) : pendingWorkflows.length === 0 ? (
          <div className="text-ink/60 text-sm">No workflows currently pending your review.</div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {pendingWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => setSelectedWorkflowId(workflow.id)}
                className={`border-2 px-3.5 py-3 cursor-pointer transition ${
                  selectedWorkflowId === workflow.id ? 'border-primary bg-primary/10 shadow-hard-sm' : 'border-ink hover:bg-muted'
                }`}
              >
                <p className="font-bold text-sm uppercase tracking-wide text-ink">{workflow.workflowType.replace(/_/g, ' ')}</p>
                <p className="text-xs text-ink/60 mt-0.5">Parcel: {workflow.parcelId}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <h2 className={sectionHeadingClass}>
          <Eye className="w-5 h-5 text-secondary" aria-hidden="true" />
          Workflow Review
        </h2>
        {selectedWorkflowId ? (
          <WorkflowReviewPanel workflowId={selectedWorkflowId} officerDepartment={department} />
        ) : (
          <p className="text-sm text-ink/60">Select a workflow from the list to review it.</p>
        )}
      </div>
    </div>
  );
};

export default AssignedRequestsPage;
