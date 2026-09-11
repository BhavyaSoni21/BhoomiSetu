import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Eye, FileText, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Filter } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';
import { ParcelDocument } from '../../types/parcelDocument';
import { ParcelSummary } from '../../types/parcel';
import AuthenticatedDocumentImage from '../../features/parcels/AuthenticatedDocumentImage';
import WorkflowReviewPanel from '../../features/officer/WorkflowReviewPanel';
import BackButton from '../../components/BackButton';

interface AssignedRequestsPageProps {
  department: string;
}

interface ParcelRequestGroupProps {
  parcelId: string;
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (workflowId: string) => void;
}

const ParcelRequestGroup: React.FC<ParcelRequestGroupProps> = ({
  parcelId,
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
}) => {
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
    <div className="p-4 rounded-xl border border-gov-border bg-surface-1 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-bold text-sm text-text-heading flex items-center gap-1.5">
            <span className="font-mono text-brand-900">
              {parcel?.ulpin ?? `Parcel #${parcelId.substring(0, 8)}`}
            </span>
          </h3>
          <p className="text-[11px] font-mono text-text-secondary">
            {parcel ? `${parcel.stateCode}-${parcel.districtCode} · ${parcel.areaSqM.toLocaleString()} m²` : 'Loading...'}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-2 text-text-secondary">
          {workflows.length} {workflows.length === 1 ? 'case' : 'cases'}
        </span>
      </div>

      {documents.length > 0 && (
        <div className="pt-2 border-t border-gov-border">
          <p className="text-[10px] font-mono uppercase text-text-muted mb-1.5 font-semibold">
            On-File Land Records
          </p>
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <div key={doc.id} className="w-16">
                <AuthenticatedDocumentImage
                  src={`/parcels/${parcelId}/documents/${doc.id}/file`}
                  alt={doc.documentType}
                  className="w-16 h-20 object-cover rounded-lg border border-gov-border shadow-xs"
                  zoomable
                />
                <span className="mt-0.5 block text-center rounded text-[8px] font-mono font-bold uppercase truncate text-text-muted">
                  {doc.registrationStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5 pt-1">
        {workflows.map((workflow) => {
          const isSelected = selectedWorkflowId === workflow.id;
          const isPending = workflow.currentStatus === 'SUBMITTED' || workflow.currentStatus === 'IN_PROGRESS';
          const isApproved = workflow.currentStatus === 'APPROVED';

          return (
            <button
              key={workflow.id}
              type="button"
              onClick={() => onSelectWorkflow(workflow.id)}
              className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-brand-700 bg-brand-900/[0.04] shadow-sm font-semibold'
                  : 'border-gov-border hover:bg-surface-2/60 bg-surface-1'
              }`}
            >
              <div className="min-w-0 flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-brand-900 text-white' : 'bg-surface-2 text-brand-900'
                }`}>
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-heading font-bold text-text-heading truncate">
                    {workflow.workflowType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[10px] font-mono text-text-muted">
                    #{workflow.id.substring(0, 8)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {workflow.evidenceFileName && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    Evidence
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold ${
                    isApproved
                      ? 'bg-green-100 text-green-800'
                      : isPending
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {workflow.currentStatus}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AssignedRequestsPage: React.FC<AssignedRequestsPageProps> = ({ department }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(() => searchParams.get('workflow'));
  const [pendingOnly, setPendingOnly] = useState(true);

  useEffect(() => {
    const workflowParam = searchParams.get('workflow');
    if (workflowParam) setSelectedWorkflowId(workflowParam);
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
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      {/* Page Header */}
      <div className="pb-4 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <ClipboardList className="w-4 h-4 text-action-600" />
            <span>Adjudication & Verification Bench</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            Assigned Service Requests
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Department queue for <span className="font-semibold text-text-heading">{department.replace(/_/g, ' ')}</span>. Cross-verify deed documents and issue statutory decisions.
          </p>
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gov-border bg-surface-1 text-xs font-heading font-bold text-text-primary cursor-pointer transition hover:bg-surface-2">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-700"
          />
          Show Pending Actions Only ({workflows.filter((w) => myStepOf(w)?.status === 'PENDING').length})
        </label>
      </div>

      {/* Main 2-Column Split: Case List + Adjudication Panel */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Cases List */}
        <div className="lg:col-span-5 gov-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gov-border">
            <h2 className="text-sm font-heading font-bold text-text-heading flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-action-600" />
              Incoming Cases ({visibleWorkflows.length})
            </h2>
            <span className="text-[11px] font-mono text-text-muted">
              {parcelIds.length} Parcels
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-text-muted">Loading department workflows…</div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-gov-error">Error loading workflow queue.</div>
          ) : parcelIds.length === 0 ? (
            <div className="p-8 text-center bg-surface-2 rounded-xl border border-gov-border">
              <CheckCircle2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
              <p className="text-sm font-semibold text-text-heading">Queue Clear</p>
              <p className="text-xs text-text-secondary mt-1">
                No active workflows require your department review at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
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

        {/* Right Column: Workflow Review & Decision Panel */}
        <div className="lg:col-span-7 gov-card p-5 space-y-4 sticky top-6">
          <div className="flex items-center justify-between pb-3 border-b border-gov-border">
            <h2 className="text-sm font-heading font-bold text-text-heading flex items-center gap-2">
              <Eye className="w-4 h-4 text-brand-700" />
              Case Review & Officer Decision
            </h2>
            {selectedWorkflowId && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-brand-900 text-white">
                #{selectedWorkflowId.substring(0, 8)}
              </span>
            )}
          </div>

          {selectedWorkflowId ? (
            <WorkflowReviewPanel workflowId={selectedWorkflowId} officerDepartment={department} />
          ) : (
            <div className="py-20 text-center rounded-xl bg-surface-2 border border-gov-border">
              <Eye className="w-10 h-10 mx-auto text-text-muted mb-2 opacity-50" />
              <p className="text-sm font-semibold text-text-heading">Select a Case to Review</p>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                Click any workflow in the left column to view citizen-submitted evidence, compare records, and issue approval or rejection orders.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignedRequestsPage;
