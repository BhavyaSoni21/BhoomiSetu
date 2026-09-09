import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Eye, FileText } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';
import { ParcelDocument } from '../../types/parcelDocument';
import { ParcelSummary } from '../../types/parcel';
import AuthenticatedDocumentImage from '../../features/parcels/AuthenticatedDocumentImage';
import WorkflowReviewPanel from '../../features/officer/WorkflowReviewPanel';

interface AssignedRequestsPageProps {
  department: string;
}

const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

const STATUS_BADGE_STYLES: Record<string, string> = {
  PENDING: 'border-accent text-secondary-strong',
  SUBMITTED: 'border-accent text-secondary-strong',
  IN_PROGRESS: 'border-accent text-secondary-strong',
  APPROVED: 'border-primary text-primary',
  REJECTED: 'border-secondary text-secondary-strong',
};

interface ParcelRequestGroupProps {
  parcelId: string;
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (workflowId: string) => void;
}

// One section per parcel that has at least one request in this officer's
// department queue - shows the parcel's own stored land-property papers
// (GET /parcels/:id/documents, same as ProfilePage's ParcelDocumentsCard)
// plus every request raised against it, each opening inline review
// (WorkflowReviewPanel, which already surfaces a request's own submitted
// evidence separately from the parcel's official documents). Merged into
// this page 2026-09-10 (docs/ADMIN_PANEL_ISSUES.md follow-up, per the
// user's explicit "the documents should be the part of... Assigned
// Requests... as the requests are raised") - was its own "Documents" nav
// item/page (OfficerDocumentsPage.tsx) that just duplicated this same
// (department) workflow list, grouped differently.
const ParcelRequestGroup: React.FC<ParcelRequestGroupProps> = ({ parcelId, workflows, selectedWorkflowId, onSelectWorkflow }) => {
  const { t } = useTranslation();
  const { data: parcel } = useQuery<ParcelSummary>(
    ['parcel', parcelId],
    async () => (await apiService.get(`/parcels/${parcelId}`)).data,
  );

  const { data: documents = [] } = useQuery<ParcelDocument[]>(
    ['parcel-documents', parcelId],
    async () => (await apiService.get(`/parcels/${parcelId}/documents`)).data,
  );

  return (
    <div className="border-2 border-ink/20 p-3">
      <h3 className="font-bold text-sm text-ink mb-2">
        {parcel?.ulpin ?? t('officerPortal.parcelFallbackLabel', { id: parcelId.substring(0, 8) })}
      </h3>

      {documents.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {documents.map((doc) => (
            <div key={doc.id} className="w-20">
              <AuthenticatedDocumentImage
                src={`/parcels/${parcelId}/documents/${doc.id}/file`}
                alt={doc.documentType}
                className="w-20 h-24 object-cover border-2 border-ink"
                zoomable
              />
              <span className="mt-0.5 block text-center border border-ink/20 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink/70">
                {doc.registrationStatus}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            type="button"
            onClick={() => onSelectWorkflow(workflow.id)}
            className={`w-full flex items-center justify-between gap-2 border-2 px-2.5 py-2 text-left transition ${
              selectedWorkflowId === workflow.id ? 'border-primary bg-primary/10 shadow-hard-sm' : 'border-ink/20 hover:bg-muted'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wide text-ink flex items-center gap-1.5 min-w-0">
              <FileText className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
              <span className="truncate">{workflow.workflowType.replace(/_/g, ' ')}</span>
              {workflow.evidenceFileName && (
                <span className="shrink-0 text-[9px] font-bold uppercase text-primary border border-primary/50 px-1 py-0.5">
                  {t('officerPortal.evidenceBadge')}
                </span>
              )}
            </span>
            <span
              className={`shrink-0 border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                STATUS_BADGE_STYLES[workflow.currentStatus] ?? 'border-ink/20 text-ink/60'
              }`}
            >
              {workflow.currentStatus}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Request ID, parcel, type, status, per-row -> review detail
// (docs/FRONTEND_UPGRADE_SPEC.md §5) - the two-column workflow-list +
// review-panel section that used to live directly on OfficerPortal's single
// dashboard, now its own page. Uses the same ('officer-workflows', department)
// query key the Dashboard's stat cards use, so navigating between them
// doesn't re-fetch. Deep-linkable via ?workflow=<id> (NotificationFeed.tsx -
// an officer's notification about a request lands here with that request
// already selected, not just on the bare list).
const AssignedRequestsPage: React.FC<AssignedRequestsPageProps> = ({ department }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(() => searchParams.get('workflow'));
  const [pendingOnly, setPendingOnly] = useState(true);

  // A deep link should win even if it arrives after the initial render
  // (e.g. clicking a second notification while already on this page).
  useEffect(() => {
    const workflowParam = searchParams.get('workflow');
    if (workflowParam) setSelectedWorkflowId(workflowParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['officer-workflows', department],
    async () => (await apiService.get('/workflows', { params: { department } })).data,
  );

  const myStepOf = (workflow: Workflow) => workflow.steps.find((s) => s.department === department);
  const visibleWorkflows = pendingOnly ? workflows.filter((w) => myStepOf(w)?.status === 'PENDING') : workflows;
  const parcelIds = Array.from(new Set(visibleWorkflows.map((w) => w.parcelId)));
  const workflowsByParcel = (parcelId: string) => visibleWorkflows.filter((w) => w.parcelId === parcelId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className={`${sectionHeadingClass} mb-0`}>
            <ClipboardList className="w-5 h-5 text-secondary" aria-hidden="true" />
            {t('officerPortal.assignedWorkflowsHeading')}
          </h2>
          <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink/60 cursor-pointer">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
              className="w-4 h-4 border-2 border-ink accent-primary"
            />
            {t('officerPortal.pendingOnlyLabel')}
          </label>
        </div>
        {isLoading ? (
          <div className="text-ink/60 text-sm">{t('officerPortal.loadingWorkflows')}</div>
        ) : error ? (
          <div className="text-ink/60 text-sm">{t('officerPortal.errorLoadingWorkflows')}</div>
        ) : parcelIds.length === 0 ? (
          <div className="text-ink/60 text-sm">{t('officerPortal.noPendingWorkflows')}</div>
        ) : (
          <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1">
            {parcelIds.map((parcelId) => (
              <ParcelRequestGroup
                key={parcelId}
                parcelId={parcelId}
                workflows={workflowsByParcel(parcelId)}
                selectedWorkflowId={selectedWorkflowId}
                onSelectWorkflow={setSelectedWorkflowId}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <h2 className={sectionHeadingClass}>
          <Eye className="w-5 h-5 text-secondary" aria-hidden="true" />
          {t('officerPortal.workflowReviewHeading')}
        </h2>
        {selectedWorkflowId ? (
          <WorkflowReviewPanel workflowId={selectedWorkflowId} officerDepartment={department} />
        ) : (
          <p className="text-sm text-ink/60">{t('officerPortal.selectWorkflowPrompt')}</p>
        )}
      </div>
    </div>
  );
};

export default AssignedRequestsPage;
