import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Eye, FileText, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Filter, Table, Layout, AlertCircle, Check, X, TrendingUp, Flag, Search, MapPin, Upload, Radio, ArrowRightLeft } from 'lucide-react';
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

// Department-specific column configuration
interface DepartmentColumn {
  key: string;
  header: string;
  render: (workflow: Workflow, parcel: ParcelSummary | undefined, documents: ParcelDocument[]) => React.ReactNode;
}

const getDepartmentColumns = (department: string, t: (key: string) => string): DepartmentColumn[] => {
  const commonColumns: DepartmentColumn[] = [
    {
      key: 'workflowType',
      header: t('assignedRequestsPage.colWorkflowType'),
      render: (workflow) => (
        <span className="font-mono text-xs text-text-heading">
          {workflow.workflowType.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('assignedRequestsPage.colStatus'),
      render: (workflow) => {
        const isPending = workflow.currentStatus === 'SUBMITTED' || workflow.currentStatus === 'IN_PROGRESS';
        const isApproved = workflow.currentStatus === 'APPROVED';
        return (
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
        );
      },
    },
  ];

  const deptSpecificColumns: Record<string, DepartmentColumn[]> = {
    LAND_RECORDS: [
      {
        key: 'ocrMatch',
        header: t('assignedRequestsPage.colOCRMatch'),
        render: (workflow) => {
          const precheck = workflow.verificationPrecheck ? JSON.parse(workflow.verificationPrecheck) : null;
          const matchPercent = precheck?.checks
            ? Math.round((precheck.checks.filter((c: any) => c.status === 'MATCHED').length / precheck.checks.length) * 100)
            : null;
          if (matchPercent === null) return <span className="text-text-muted text-xs">—</span>;
          const color = matchPercent >= 80 ? 'text-green-700' : matchPercent >= 50 ? 'text-amber-700' : 'text-red-700';
          return (
            <span className={`font-mono font-semibold text-xs ${color}`}>
              {matchPercent}%
            </span>
          );
        },
      },
    ],
    REGISTRATION: [
      {
        key: 'duplicateFlag',
        header: t('assignedRequestsPage.colDuplicateFlag'),
        render: (workflow, parcel, documents) => {
          // Check if any document has duplicate flag in registrationStatus
          const hasDuplicate = documents.some(d => 
            d.registrationStatus.includes('DUPLICATE') || d.registrationStatus.includes('CONFLICT')
          );
          if (hasDuplicate) {
            return (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200">
                {t('assignedRequestsPage.duplicateFlagYes')}
              </span>
            );
          }
          return <span className="text-text-muted text-xs">—</span>;
        },
      },
    ],
    PLANNING: [
      {
        key: 'zoningConflict',
        header: t('assignedRequestsPage.colZoningConflict'),
        render: (workflow, parcel) => {
          // Mock: check if parcel has zoning mismatch (in real app, would come from parcel data)
          const hasConflict = parcel?.localId?.includes('ZONE_CONFLICT') || false;
          if (hasConflict) {
            return (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200 flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5" />
                {t('assignedRequestsPage.zoningConflictYes')}
              </span>
            );
          }
          return (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-green-50 text-green-800 border border-green-200 flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              {t('assignedRequestsPage.zoningConflictNo')}
            </span>
          );
        },
      },
    ],
    TAX: [
      {
        key: 'autoReassessment',
        header: t('assignedRequestsPage.colAutoReassessment'),
        render: (workflow) => {
          const isMutation = workflow.workflowType === 'MUTATION_REQUEST' || workflow.workflowType === 'MUTATION';
          const triggered = isMutation && workflow.currentStatus === 'APPROVED';
          if (triggered) {
            return (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" />
                {t('assignedRequestsPage.autoReassessmentTriggered')}
              </span>
            );
          }
          return <span className="text-text-muted text-xs">—</span>;
        },
      },
    ],
    RESTRICTION: [
      {
        key: 'blocksTransfer',
        header: t('assignedRequestsPage.colBlocksTransfer'),
        render: (workflow, parcel) => {
          // Mock: check if restriction blocks transfer
          const blocks = parcel?.localId?.includes('RESTRICTED') || workflow.workflowType.includes('RESTRICTION');
          if (blocks) {
            return (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200 flex items-center gap-1">
                <Flag className="w-2.5 h-2.5" />
                {t('assignedRequestsPage.blocksTransferYes')}
              </span>
            );
          }
          return (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-green-50 text-green-800 border border-green-200 flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              {t('assignedRequestsPage.blocksTransferNo')}
            </span>
          );
        },
      },
    ],
    ENCUMBRANCE: [
      {
        key: 'disputeRestrictionCheck',
        header: t('assignedRequestsPage.colDisputeRestrictionCheck'),
        render: (workflow, parcel) => {
          // Mock: check dispute/restriction status
          const hasDispute = parcel?.localId?.includes('DISPUTE') || false;
          const hasRestriction = parcel?.localId?.includes('RESTRICTED') || false;
          if (hasDispute || hasRestriction) {
            return (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-red-50 text-red-800 border border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                {hasDispute && hasRestriction ? t('assignedRequestsPage.disputeRestrictionBoth') : hasDispute ? t('assignedRequestsPage.disputeRestrictionDispute') : t('assignedRequestsPage.disputeRestrictionRestriction')}
              </span>
            );
          }
          return (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-green-50 text-green-800 border border-green-200 flex items-center gap-1">
              <ShieldCheck className="w-2.5 h-2.5" />
              {t('assignedRequestsPage.disputeRestrictionClear')}
            </span>
          );
        },
      },
    ],
    DISPUTE: [
      {
        key: 'evidenceChain',
        header: t('assignedRequestsPage.colEvidenceChain'),
        render: (workflow, parcel, documents) => {
          const hasEvidence = workflow.evidenceFileName || documents.length > 0;
          if (hasEvidence) {
            return (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-green-50 text-green-800 border border-green-200 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                {t('assignedRequestsPage.evidenceChainComplete')}
              </span>
            );
          }
          return (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              {t('assignedRequestsPage.evidenceChainPartial')}
            </span>
          );
        },
      },
    ],
    SURVEY: [
      {
        key: 'areaDelta',
        header: t('assignedRequestsPage.colAreaDelta'),
        render: (workflow, parcel) => {
          // Mock: calculate area delta (in real app, from survey measurement)
          const measuredArea = parcel?.areaSqM ? parcel.areaSqM * (0.95 + Math.random() * 0.1) : null;
          if (measuredArea && parcel?.areaSqM) {
            const delta = ((measuredArea - parcel.areaSqM) / parcel.areaSqM) * 100;
            const color = Math.abs(delta) <= 5 ? 'text-green-700' : Math.abs(delta) <= 15 ? 'text-amber-700' : 'text-red-700';
            const icon = delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <Search className="w-2.5 h-2.5" />;
            return (
              <span className={`font-mono font-semibold text-xs ${color} flex items-center gap-1`}>
                {icon}
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
              </span>
            );
          }
          return <span className="text-text-muted text-xs">—</span>;
        },
      },
      {
        key: 'geometryUpdated',
        header: t('assignedRequestsPage.colGeometryUpdated'),
        render: (workflow, parcel) => {
          // Mock: check if geometry was updated
          const updated = parcel?.localId?.includes('GEOM_UPDATED') || Math.random() > 0.7;
          if (updated) {
            return (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5" />
                {t('assignedRequestsPage.geometryUpdatedYes')}
              </span>
            );
          }
          return (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-surface-2 text-text-muted border border-gov-border flex items-center gap-1">
              <X className="w-2.5 h-2.5" />
              {t('assignedRequestsPage.geometryUpdatedNo')}
            </span>
          );
        },
      },
    ],
  };

  return [...commonColumns, ...(deptSpecificColumns[department] || [])];
};

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
            {parcel ? `${parcel.stateCode}-${parcel.districtCode} · ${parcel.areaSqM.toLocaleString()} m²` : t('assignedRequestsPage.loadingParcel')}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-2 text-text-secondary">
          {workflows.length} {workflows.length === 1 ? t('assignedRequestsPage.casesSingular') : t('assignedRequestsPage.casesPlural')}
        </span>
      </div>

      {documents.length > 0 && (
        <div className="pt-2 border-t border-gov-border">
          <p className="text-[10px] font-mono uppercase text-text-muted mb-1.5 font-semibold">
            {t('assignedRequestsPage.onFileLandRecords')}
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
                    {t('assignedRequestsPage.evidenceBadge')}
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
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

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

  // Get department-specific columns for table view
  const tableColumns = useMemo(() => getDepartmentColumns(department, t), [department, t]);

  // Flatten workflows for table view
  const flatWorkflows = useMemo(() => visibleWorkflows.flatMap((w) => ({
    workflow: w,
    parcelId: w.parcelId,
  })), [visibleWorkflows]);

  // Render case list content based on state
  const renderCaseList = () => {
    if (isLoading) {
      return (
        <div className="py-12 text-center text-sm text-text-muted">
          {t('assignedRequestsPage.loadingWorkflows')}
        </div>
      );
    }
    if (error) {
      return (
        <div className="py-8 text-center text-sm text-gov-error">
          {t('assignedRequestsPage.errorLoadingWorkflows')}
        </div>
      );
    }
    if (parcelIds.length === 0) {
      return (
        <div className="p-8 text-center bg-surface-2 rounded-xl border border-gov-border">
          <CheckCircle2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
          <p className="text-sm font-semibold text-text-heading">{t('assignedRequestsPage.queueClearHeading')}</p>
          <p className="text-xs text-text-secondary mt-1">
            {t('assignedRequestsPage.queueClearDesc')}
          </p>
        </div>
      );
    }
    if (viewMode === 'card') {
      return (
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
      );
    }
    // Table view
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gov-border text-left text-[10px] font-mono uppercase text-text-muted">
              <th className="pb-2 pr-4 font-semibold">{t('assignedRequestsPage.colParcel')}</th>
              <th className="pb-2 pr-4 font-semibold">{t('assignedRequestsPage.colWorkflowType')}</th>
              <th className="pb-2 pr-4 font-semibold">{t('assignedRequestsPage.colStatus')}</th>
              {tableColumns.filter(c => c.key !== 'workflowType' && c.key !== 'status').map((col) => (
                <th key={col.key} className="pb-2 pr-4 font-semibold">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gov-border/50">
            {flatWorkflows.map(({ workflow, parcelId }) => {
              const isSelected = selectedWorkflowId === workflow.id;
              return (
                <tr
                  key={workflow.id}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-brand-900/[0.04]' : 'hover:bg-surface-2/60'
                  }`}
                >
                  <td className="py-3 pr-4 font-mono text-xs text-brand-900">
                    {parcelId.substring(0, 8)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs text-text-heading">
                      {workflow.workflowType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {tableColumns.find(c => c.key === 'status')?.render(workflow, undefined, [])}
                  </td>
                  {tableColumns.filter(c => c.key !== 'workflowType' && c.key !== 'status').map((col) => (
                    <td key={col.key} className="py-3 pr-4">
                      {col.render(workflow, undefined, [])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      {/* Page Header */}
      <div className="pb-4 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <ClipboardList className="w-4 h-4 text-action-600" />
            <span>{t('assignedRequestsPage.pageSubtitle')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            {t('assignedRequestsPage.pageHeading')}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            {t('assignedRequestsPage.pageDesc1')} <span className="font-semibold text-text-heading">{department.replace(/_/g, ' ')}</span>. {t('assignedRequestsPage.pageDesc2')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gov-border bg-surface-1 text-xs font-heading font-bold text-text-primary cursor-pointer transition hover:bg-surface-2">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
              className="w-4 h-4 rounded accent-brand-700"
            />
            {t('assignedRequestsPage.pendingOnlyLabel')} ({workflows.filter((w) => myStepOf(w)?.status === 'PENDING').length})
          </label>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-gov-border bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition ${
                viewMode === 'card'
                  ? 'bg-brand-900 text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-heading'
              }`}
            >
              <Layout className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition ${
                viewMode === 'table'
                  ? 'bg-brand-900 text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-heading'
              }`}
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Case List + Adjudication Panel */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Cases List */}
        <div className="lg:col-span-5 gov-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gov-border">
            <h2 className="text-sm font-heading font-bold text-text-heading flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-action-600" />
              {t('assignedRequestsPage.incomingCasesHeading')} ({visibleWorkflows.length})
            </h2>
            <span className="text-[11px] font-mono text-text-muted">
              {parcelIds.length} {t('assignedRequestsPage.parcelsLabel')}
</span>
          </div>

          {renderCaseList()}
        </div>

        {/* Right Column: Workflow Review & Decision Panel */}
        <div className="lg:col-span-7 gov-card p-5 space-y-4 sticky top-6">
          <div className="flex items-center justify-between pb-3 border-b border-gov-border">
            <h2 className="text-sm font-heading font-bold text-text-heading flex items-center gap-2">
              <Eye className="w-4 h-4 text-brand-700" />
              {t('assignedRequestsPage.reviewPanelHeading')}
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
              <p className="text-sm font-semibold text-text-heading">{t('assignedRequestsPage.selectCaseHeading')}</p>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                {t('assignedRequestsPage.selectCaseDesc')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignedRequestsPage;
