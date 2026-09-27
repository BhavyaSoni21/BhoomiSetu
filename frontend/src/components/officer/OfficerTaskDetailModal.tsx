import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../context/LanguageContext';
import { CaseOut, DepartmentTask, CaseDetailOut, ProposedFieldChangeOut, FieldChangeApprovalIn, AppointmentOut } from '../../types/aiFlow';
import { Parcel360Response } from '../../types/parcel360';
import apiService from '../../services/apiService';
import VerifierAssignmentPanel from '../../features/officer/VerifierAssignmentPanel';
import { VerifierFindingsSection } from '../../features/officer/WorkflowReviewPanel';
import { X, User, Send, ShieldCheck, Download, MapPin, UserCheck, AlertCircle, FileText, Clock, User as UserIcon, Package, CheckCircle2, AlertTriangle, RefreshCw, Calendar } from 'lucide-react';

// The /cases/* endpoints serialize camelCase (CamelModel, default by_alias=True),
// which the shared snake_case types don't match. Read the real wire keys for the
// timeline and application, the two things this modal renders from those feeds.
type TimelineEvent = {
  id: string;
  eventType: string;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  actorDepartment?: string | null;
  previousState?: string | null;
  newState?: string | null;
  createdAt: string;
};
type CaseApplication = {
  id: string;
  originalInput?: string | null;
  aiDraft?: string | null;
  finalSubmittedVersion?: string | null;
  generatedDocumentPath?: string | null;
  generatedAt?: string | null;
  citizenConfirmed?: boolean;
  citizenConfirmationTimestamp?: string | null;
};

interface OfficerTaskDetailModalProps {
  taskId: string;
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
}

const DECISION_TYPES = ['APPROVE', 'REJECT', 'RETURN_FOR_REVIEW'];

interface ProposalCardProps {
  proposal: ProposedFieldChangeOut;
  onApprove: (proposalId: string, remarks: string) => void;
  onReject: (proposalId: string, remarks: string) => void;
  isProcessing: boolean;
}

function ProposalCard({ proposal, onApprove, onReject, isProcessing }: ProposalCardProps) {
  const { t } = useTranslation();
  const [remarks, setRemarks] = useState('');

  const isResolved = proposal.status !== 'PENDING';

  const handleApprove = () => {
    if (!remarks.trim()) return;
    onApprove(proposal.id, remarks);
  };

  const handleReject = () => {
    if (!remarks.trim()) return;
    onReject(proposal.id, remarks);
  };

  return (
    <div className="gov-card p-4 border border-gov-border">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">
            {proposal.department} · {proposal.field_name}
          </div>
          <div className="text-sm font-medium text-text-heading">
            {t('officerTaskDetail.proposalStatus', 'Status')}: {proposal.status}
          </div>
        </div>
        {!isResolved && (
          <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-medium">
            {t('officerTaskDetail.statusPending', 'Pending')}
          </span>
        )}
        {isResolved && proposal.status === 'APPROVED' && (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-medium">
            {t('officerTaskDetail.statusApproved', 'Approved')}
          </span>
        )}
        {isResolved && proposal.status === 'REJECTED' && (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-medium">
            {t('officerTaskDetail.statusRejected', 'Rejected')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">
            {t('officerTaskDetail.currentValueLabel', 'Current Value')}
          </div>
          <div className="text-sm bg-surface-2/50 p-2 rounded-lg border border-gov-border break-words">
            {proposal.current_value || t('common.notApplicable', 'N/A')}
          </div>
        </div>
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">
            {t('officerTaskDetail.proposedValueLabel', 'Proposed Value')}
          </div>
          <div className="text-sm bg-surface-2/50 p-2 rounded-lg border border-gov-border break-words text-brand-900">
            {proposal.proposed_value}
          </div>
        </div>
      </div>

      {proposal.reason && (
        <div className="mb-3">
          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">
            {t('officerTaskDetail.reasonLabel', 'Reason')}
          </div>
          <div className="text-sm text-text-secondary">{proposal.reason}</div>
        </div>
      )}

      {!isResolved && (
        <>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={t('officerTaskDetail.approvalRemarksPlaceholder', 'Enter your decision remarks (required)')}
            className="w-full px-3 py-2 border border-gov-border rounded-lg text-sm resize-none"
            rows={3}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleApprove}
              disabled={!remarks.trim() || isProcessing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-800 text-white hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3 h-3" />
              {t('officerTaskDetail.approveButton', 'Approve')}
            </button>
            <button
              onClick={handleReject}
              disabled={!remarks.trim() || isProcessing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-800 text-white hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <AlertCircle className="w-3 h-3" />
              {t('officerTaskDetail.rejectButton', 'Reject')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const OfficerTaskDetailModal: React.FC<OfficerTaskDetailModalProps> = ({
  taskId,
  caseId,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'documents' | 'database' | 'decision'>('overview');
  const [decision, setDecision] = useState('');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [decisionRemarksError, setDecisionRemarksError] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [checklistRemarks, setChecklistRemarks] = useState('');

  const { data: task, isLoading: taskLoading } = useQuery<DepartmentTask>(
    ['task', taskId],
    () => apiService.get(`/cases/${caseId}/tasks/${taskId}`).then(res => res.data),
    { enabled: isOpen },
  );

  const { data: timeline = [] } = useQuery<TimelineEvent[]>(
    ['timeline', caseId],
    () => apiService.get(`/cases/${caseId}/timeline`).then(res => res.data),
    { enabled: isOpen },
  );

  const { data: sla } = useQuery<{ status: string; message: string }>(
    ['task-sla', taskId],
    () => apiService.get(`/cases/${caseId}/tasks/${taskId}/sla`).then(res => res.data),
    { enabled: isOpen },
  );

  const { data: application, isLoading: applicationLoading } = useQuery<CaseApplication>(
    ['application', caseId],
    () => apiService.get(`/cases/${caseId}/application`).then(res => res.data),
    { enabled: isOpen && (activeTab === 'documents' || activeTab === 'overview') },
  );

  const downloadPdf = async (url: string, filename: string) => {
    const response = await apiService.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const { data: caseDetail } = useQuery<CaseDetailOut>(
    ['case-detail', caseId],
    () => apiService.get(`/cases/${caseId}/detail`).then(res => res.data),
    { enabled: isOpen && activeTab === 'overview' },
  );

  const parcelId = caseDetail?.case?.parcel_id;
  const { data: parcel360 } = useQuery<Parcel360Response>(
    ['parcel-360', parcelId ?? ''],
    () => apiService.get(`/parcels/${parcelId}/360`).then(res => res.data),
    { enabled: !!parcelId && activeTab === 'overview' },
  );

  // Officer reviews the original documents the citizen brings to a booked
  // appointment (§45) - the citizen lists them in required_documents; the
  // officer confirms the slot and marks it COMPLETED once the originals have
  // been reviewed in person. PATCH /appointments/{id} is staff-writable.
  const { data: appointments = [] } = useQuery<AppointmentOut[]>(
    ['case-appointments', caseId],
    () => apiService.get(`/cases/${caseId}/appointments`).then(res => res.data),
    { enabled: isOpen && activeTab === 'overview' },
  );

  const appointmentMutation = useMutation({
    mutationFn: (payload: { appointmentId: string; status: string }) =>
      apiService.patch(`/appointments/${payload.appointmentId}`, { status: payload.status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['case-appointments', caseId] }),
  });

  const handleParcel360 = () => {
    if (parcelId) {
      window.open(`/parcels/${parcelId}`, '_blank', 'noopener,noreferrer');
    }
  };

  const { data: proposals = [], isLoading: proposalsLoading, refetch: refetchProposals } = useQuery<ProposedFieldChangeOut[]>(
    ['field-proposals', caseId],
    () => apiService.get(`/cases/${caseId}/field-proposals`).then(res => res.data),
    { enabled: isOpen && activeTab === 'database' },
  );

  const approvalMutation = useMutation({
    mutationFn: (payload: { proposalId: string; action: 'APPROVE' | 'REJECT'; remarks?: string }) =>
      apiService.post(`/cases/${caseId}/field-proposals/${payload.proposalId}/${payload.action.toLowerCase()}`, {
        decision: payload.action,
        remarks: payload.remarks || null,
      }),
    onSuccess: () => {
      refetchProposals();
    },
  });

  const handleApprove = (proposalId: string, remarks: string) => {
    approvalMutation.mutate({ proposalId, action: 'APPROVE', remarks });
  };

  const handleReject = (proposalId: string, remarks: string) => {
    approvalMutation.mutate({ proposalId, action: 'REJECT', remarks });
  };

  const resolveMutation = useMutation({
    mutationFn: (payload: { decision: string; officer_id: string; remarks?: string }) =>
      apiService.post(`/cases/${caseId}/tasks/${taskId}/resolve`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      setDecision('');
      setDecisionRemarks('');
      setActiveTab('overview');
    },
  });

  const advanceMutation = useMutation({
    mutationFn: (payload: { status: string; remarks?: string }) =>
      apiService.patch(`/cases/${caseId}/tasks/${taskId}/advance`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });

  const checklistMutation = useMutation({
    mutationFn: (payload: { checklist: Record<string, boolean>; remarks: string }) =>
      apiService.post(`/cases/${caseId}/tasks/${taskId}/verification-checklist`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });

  const handleChecklistSubmit = () => {
    checklistMutation.mutate({ checklist, remarks: checklistRemarks });
  };

  const needsVerification = task?.resolutionMode === 'FIELD_VERIFICATION' || task?.resolutionMode === 'OFFLINE_APPOINTMENT';
  const CHECKLIST_ITEMS = [
    'officerTaskDetail.checklist.originalDocument',
    'officerTaskDetail.checklist.citizenIdentity',
    'officerTaskDetail.checklist.documentNumber',
    'officerTaskDetail.checklist.supportingDocument',
    'officerTaskDetail.checklist.signatures',
    'officerTaskDetail.checklist.scanUploaded',
    'officerTaskDetail.checklist.officerRemarks',
  ];

  if (!isOpen) return null;

  const handleResolve = () => {
    if (!decision) return;
    if (!decisionRemarks.trim()) {
      setDecisionRemarksError(t('officerTaskDetail.remarksRequiredError', 'Remarks are required to submit a decision.'));
      return;
    }
    setDecisionRemarksError('');
    resolveMutation.mutate({
      decision,
      officer_id: task?.assignedOfficerId || '',
      remarks: decisionRemarks,
    });
  };

  const handleAdvance = (newStatus: string) => {
    advanceMutation.mutate({ status: newStatus });
  };

  const slaColor = sla?.status === 'BREACH' ? 'text-red-600' : sla?.status === 'WARNING' ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-16 z-50 pointer-events-none">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gov-border w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden animate-fade-up pointer-events-auto">
        <div className="p-5 border-b border-gov-border flex items-center justify-between">
          <h2 className="text-xl font-heading font-bold text-text-heading">
            {t('officerTaskDetail.modalTitle', 'Task Detail')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-text-muted hover:bg-surface-2 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gov-border px-5">
          <nav className="flex gap-6 text-xs font-mono font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 border-b-2 transition ${activeTab === 'overview' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary'}`}
            >
              {t('officerTaskDetail.tabOverview', 'Overview')}
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-3 px-1 border-b-2 transition ${activeTab === 'timeline' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary'}`}
            >
              {t('officerTaskDetail.tabTimeline', 'Timeline')}
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-3 px-1 border-b-2 transition ${activeTab === 'documents' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary'}`}
            >
              {t('officerTaskDetail.tabDocuments', 'Documents')}
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`py-3 px-1 border-b-2 transition ${activeTab === 'database' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary'}`}
            >
              {t('officerTaskDetail.tabDatabase', 'Database Updates')}
            </button>
            <button
              onClick={() => setActiveTab('decision')}
              className={`py-3 px-1 border-b-2 transition ${activeTab === 'decision' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary'}`}
            >
              {t('officerTaskDetail.tabDecision', 'Decision')}
            </button>
          </nav>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)]">
          {taskLoading ? (
            <div className="py-8 text-center text-sm text-text-muted">{t('officerTaskDetail.loading', 'Loading task details...')}</div>
          ) : !task ? (
            <div className="py-8 text-center text-sm text-text-muted">{t('officerTaskDetail.notFound', 'Task not found')}</div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="gov-card p-4">
                      <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.fieldStatus', 'Status')}</div>
                      <div className="text-lg font-bold text-text-heading">{task.status}</div>
                      {sla && <div className={`text-xs mt-2 font-mono ${slaColor}`}>SLA: {sla.status} — {sla.message}</div>}
                    </div>
                    <div className="gov-card p-4">
                      <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.fieldResolutionMode', 'Resolution Mode')}</div>
                      <div className="text-lg font-bold text-text-heading">{task.resolutionMode || '—'}</div>
                    </div>
                    <div className="gov-card p-4">
                      <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.fieldDepartment', 'Department')}</div>
                      <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-900" />{String(task.departmentId).slice(0, 8)}</div>
                    </div>
                  </div>

                  {application && (
                    <div className="gov-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading font-bold text-sm text-text-heading flex items-center gap-2">
                          <FileText className="w-4 h-4 text-brand-900" />
                          {t('officerTaskDetail.sectionApplicationDocument', 'Application Document')}
                        </h3>
                        <button
                          onClick={() => downloadPdf(`/cases/${caseId}/documents/decision-order`, `application-${application.id.slice(0, 8)}.pdf`)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-900 text-white hover:bg-brand-700 transition flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          {t('officerTaskDetail.downloadApplication', 'Download Application')}
                        </button>
                      </div>
                      {(application.finalSubmittedVersion || application.aiDraft) ? (
                        <div className="whitespace-pre-wrap bg-surface-2/50 p-3 rounded-lg border border-gov-border text-sm text-text-secondary max-h-40 overflow-y-auto">
                          {application.finalSubmittedVersion || application.aiDraft}
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted">{t('officerTaskDetail.noVersionAvailable', 'No application version available.')}</p>
                      )}
                    </div>
                  )}

                  {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                    <div className="flex gap-2 flex-wrap">
                      {['ASSIGNED', 'IN_PROGRESS'].filter((s) => s !== task.status).map((status) => (
                        <button key={status} onClick={() => handleAdvance(status)} disabled={advanceMutation.isPending} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gov-border text-text-secondary hover:bg-surface-2 transition disabled:opacity-50">
                          {status}
                        </button>
                      ))}
                    </div>
                  )}

                  {needsVerification && task.status !== 'COMPLETED' && (
                    <div className="gov-card p-4">
                      <h3 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.verificationChecklistHeading', 'Offline Verification Checklist')}</h3>
                      <div className="space-y-2 mb-3">
                        {CHECKLIST_ITEMS.map((key) => (
                          <label key={key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checklist[key] || false}
                              onChange={(e) => setChecklist({ ...checklist, [key]: e.target.checked })}
                              className="checkbox"
                            />
                            <span className="text-text-secondary">{t(key)}</span>
                          </label>
                        ))}
                      </div>
                      <textarea
                        value={checklistRemarks}
                        onChange={(e) => setChecklistRemarks(e.target.value)}
                        placeholder={t('officerTaskDetail.checklistRemarksPlaceholder', 'Enter verification remarks (e.g. photo references, observations)')}
                        className="w-full px-3 py-2 border border-gov-border rounded-lg text-sm resize-none"
                        rows={3}
                      />
                      <button
                        onClick={handleChecklistSubmit}
                        disabled={checklistMutation.isPending}
                        className="mt-3 w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-900 hover:bg-brand-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        {checklistMutation.isPending ? t('officerTaskDetail.submittingChecklist', 'Submitting...') : t('officerTaskDetail.submitChecklist', 'Submit Verification Checklist')}
                      </button>
                    </div>
                  )}

                  {/* Verifier Assignment (§29) */}
                  {needsVerification && task.status !== 'COMPLETED' && (
                    <div className="gov-card p-4">
                      <h3 className="font-heading font-bold text-sm text-text-heading mb-3 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-brand-900" />
                        {t('officerTaskDetail.assignVerifierHeading', 'Assign Field Verifier')}
                      </h3>
                      <VerifierAssignmentPanel
                        task={task}
                        onAssigned={() => queryClient.invalidateQueries({ queryKey: ['task', taskId] })}
                      />
                    </div>
                  )}

                  {/* Verifier Findings & Evidence Review (§33, §5.6) */}
                  {needsVerification && task.assignedVerifierId && (
                    <div className="gov-card p-4">
                      <h3 className="font-heading font-bold text-sm text-text-heading mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-900" />
                        {t('officerTaskDetail.verifierFindingsHeading', 'Verifier Findings & Evidence')}
                      </h3>
                      <VerifierFindingsSection
                        workflowId={task.workflowId ?? ''}
                        caseId={caseId}
                      />
                    </div>
                  )}

                  {appointments.length > 0 && (
                    <div className="gov-card p-4">
                      <h3 className="font-heading font-bold text-sm text-text-heading mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-brand-900" />
                        {t('officerTaskDetail.appointmentsHeading', 'Appointments & Original Documents')}
                      </h3>
                      <div className="space-y-3">
                        {appointments.map((appt) => {
                          const isClosed = appt.status === 'COMPLETED' || appt.status === 'CANCELLED' || appt.status === 'NO_SHOW';
                          return (
                            <div key={appt.id} className="border border-gov-border rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-text-heading">{new Date(appt.date).toLocaleDateString()}{appt.time_slot ? ` · ${appt.time_slot}` : ''}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-surface-2 text-text-secondary">{appt.status}</span>
                              </div>
                              {appt.purpose && <p className="text-xs text-text-secondary mt-1.5">{appt.purpose}</p>}
                              <div className="mt-2">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.originalDocumentsLabel', 'Original documents to review')}</div>
                                {appt.required_documents && appt.required_documents.length > 0 ? (
                                  <ul className="list-disc list-inside text-sm text-text-secondary space-y-0.5">
                                    {appt.required_documents.map((doc, i) => <li key={i}>{doc}</li>)}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-text-muted">{t('officerTaskDetail.noOriginalDocuments', 'None specified by the citizen.')}</p>
                                )}
                              </div>
                              {!isClosed && (
                                <div className="mt-3 flex gap-2 flex-wrap">
                                  {appt.status === 'REQUESTED' && (
                                    <button
                                      onClick={() => appointmentMutation.mutate({ appointmentId: appt.id, status: 'CONFIRMED' })}
                                      disabled={appointmentMutation.isPending}
                                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gov-border text-text-secondary hover:bg-surface-2 transition disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />{t('officerTaskDetail.confirmAppointment', 'Confirm')}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => appointmentMutation.mutate({ appointmentId: appt.id, status: 'COMPLETED' })}
                                    disabled={appointmentMutation.isPending}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-900 text-white hover:bg-brand-700 transition disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    <ShieldCheck className="w-3 h-3" />{t('officerTaskDetail.markDocumentsReviewed', 'Mark Documents Reviewed')}
                                  </button>
                                  <button
                                    onClick={() => appointmentMutation.mutate({ appointmentId: appt.id, status: 'NO_SHOW' })}
                                    disabled={appointmentMutation.isPending}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gov-border text-text-secondary hover:bg-surface-2 transition disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    <AlertTriangle className="w-3 h-3" />{t('officerTaskDetail.markNoShow', 'No Show')}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {parcel360 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading font-bold text-sm text-text-heading">{t('officerTaskDetail.parcelInfoHeading', 'Parcel Information')}</h3>
                        <button
                          onClick={handleParcel360}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-900 text-white hover:bg-brand-700 transition flex items-center gap-1.5"
                        >
                          <MapPin className="w-3 h-3" />
                          {t('officerTaskDetail.parcel360Button', 'Parcel 360° →')}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.ulpinLabel', 'ULPIN')}</div>
                          <div className="text-sm font-medium text-text-heading">{parcel360.identifiers.ulpin || '—'}</div>
                        </div>
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.surveyNoLabel', 'Survey Number')}</div>
                          <div className="text-sm font-medium text-text-heading">{parcel360.identifiers.survey_number || '—'}</div>
                        </div>
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.areaLabel', 'Area')}</div>
                          <div className="text-sm font-medium text-text-heading">{parcel360.spatial.area_sq_m.toLocaleString()} m²</div>
                        </div>
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.ownerLabel', 'Owner')}</div>
                          <div className="flex items-center gap-1.5 text-sm font-medium text-text-heading">
                            <UserCheck className="w-3 h-3 text-text-muted" />
                            {parcel360.departments.landRecords?.ownerName || '—'}
                          </div>
                        </div>
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.taxStatusLabel', 'Tax Status')}</div>
                          <div className="text-sm font-medium text-text-heading">{parcel360.departments.tax?.taxStatus || '—'}</div>
                        </div>
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.disputeStatusLabel', 'Dispute Status')}</div>
                          <div className="flex items-center gap-1.5 text-sm">
                            {parcel360.departments.dispute?.hasActiveDispute ? (
                              <>
                                <AlertCircle className="w-3 h-3 text-red-500" />
                                <span className="text-red-600 font-medium">{t('officerTaskDetail.statusActive', 'Active')}</span>
                              </>
                            ) : (
                              <span className="text-text-secondary">{t('officerTaskDetail.statusNone', 'None')}</span>
                            )}
                          </div>
                        </div>
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.encumbranceLabel', 'Encumbrance')}</div>
                          <div className="text-sm font-medium text-text-heading">
                            {parcel360.departments.encumbrance?.hasEncumbrance ? t('officerTaskDetail.statusActive', 'Active') : t('officerTaskDetail.statusNone', 'None')}
                          </div>
                        </div>
                        <div className="gov-card p-3">
                          <div className="text-xs font-mono uppercase tracking-wider text-text-muted mb-1">{t('officerTaskDetail.surveyStatusLabel', 'Survey Status')}</div>
                          <div className="text-sm font-medium text-text-heading">{parcel360.departments.landRecords?.sourceIdentifier || '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  <h3 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.tabTimeline', 'Case Timeline')}</h3>
                  {timeline.length === 0 ? (
                    <div className="text-center py-6 text-sm text-text-muted">{t('officerTaskDetail.noTimeline', 'No timeline events yet.')}</div>
                  ) : (
                    <div className="space-y-3">
                      {timeline.map((event) => (
                        <div key={event.id} className="border-l-2 border-brand-900/20 pl-4 py-2">
                          <div className="flex items-center gap-2"><span className="text-xs font-mono font-bold text-brand-900">{event.eventType}</span><span className="text-xs text-text-secondary">{new Date(event.createdAt).toLocaleString()}</span></div>
                          {event.previousState && event.newState && (<div className="text-xs text-text-secondary">{event.previousState} → {event.newState}</div>)}
                          {(event.actorName || event.actorId) && (<div className="text-xs text-text-secondary">{t('officerTaskDetail.byActor', 'by')} {event.actorName || event.actorId}{event.actorDepartment ? ` · ${event.actorDepartment}` : event.actorRole ? ` (${event.actorRole})` : ''}</div>)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <h3 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.tabDocuments', 'Case Documents')}</h3>

                  {applicationLoading ? (
                    <div className="text-center py-8 text-sm text-text-muted">{t('officerTaskDetail.documentsLoading', 'Loading application documents...')}</div>
                  ) : !application ? (
                    <div className="text-center py-8 text-sm text-text-muted">{t('officerTaskDetail.noApplication', 'No application found for this case.')}</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="gov-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-heading font-bold text-sm text-text-heading">{t('officerTaskDetail.sectionApplicationDocument', 'Application Document')}</h4>
                          <button
                            onClick={() => downloadPdf(`/cases/${caseId}/documents/decision-order`, `application-${application.id.slice(0, 8)}.pdf`)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-900 text-white hover:bg-brand-700 transition flex items-center gap-1.5"
                          >
                            <Download className="w-3 h-3" />
                            {t('officerTaskDetail.downloadApplication', 'Download Application')}
                          </button>
                        </div>
                        {application.generatedDocumentPath && (
                          <p className="text-xs text-text-secondary mb-2">
                            {t('officerTaskDetail.generatedDocumentPath', 'Generated document')}: {application.generatedDocumentPath}
                            {application.generatedAt && ` · ${new Date(application.generatedAt).toLocaleString()}`}
                          </p>
                        )}
                        <div className="prose prose-sm max-w-none text-sm text-text-secondary">
                          {application.finalSubmittedVersion ? (
                            <div className="whitespace-pre-wrap bg-surface-2/50 p-3 rounded-lg border border-gov-border">{application.finalSubmittedVersion}</div>
                          ) : application.aiDraft ? (
                            <div className="whitespace-pre-wrap bg-surface-2/50 p-3 rounded-lg border border-gov-border">{application.aiDraft}</div>
                          ) : (
                            <p className="text-xs">{t('officerTaskDetail.noVersionAvailable', 'No application version available.')}</p>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${application.citizenConfirmed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {application.citizenConfirmed ? t('officerTaskDetail.confirmed', 'Citizen Confirmed') : t('officerTaskDetail.notConfirmed', 'Not Confirmed')}
                          </span>
                          {application.citizenConfirmationTimestamp && (
                            <span>{new Date(application.citizenConfirmationTimestamp).toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      <div className="gov-card p-4">
                        <h4 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.sectionFinalSubmitted', 'Final Submitted Version')}</h4>
                        {application.finalSubmittedVersion ? (
                          <div className="whitespace-pre-wrap bg-surface-2/50 p-3 rounded-lg border border-gov-border text-sm text-text-secondary max-h-60 overflow-y-auto">{application.finalSubmittedVersion}</div>
                        ) : (
                          <p className="text-xs text-text-muted">{t('officerTaskDetail.noFinalVersion', 'No final submitted version available.')}</p>
                        )}
                      </div>

                      <div className="gov-card p-4">
                        <h4 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.sectionSupportingDocuments', 'Supporting Documents')}</h4>
                        {application.originalInput ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-2 border border-gov-border rounded-lg">
                              <span className="text-sm text-text-secondary">{t('officerTaskDetail.originalInputLabel', 'Citizen Original Input')}</span>
                              <span className="text-xs font-mono text-text-muted">{application.originalInput.slice(0, 40)}…</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted">{t('officerTaskDetail.noSupportingDocs', 'No supporting documents on file for this case yet.')}</p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => downloadPdf(`/cases/${caseId}/documents/verification-report`, `verification-report-${application.id.slice(0, 8)}.pdf`)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gov-border text-text-secondary hover:bg-surface-2 transition flex items-center gap-1.5"
                          >
                            <Download className="w-3 h-3" />
                            {t('officerTaskDetail.downloadVerificationReport', 'Download Verification Report')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'database' && (
                <div className="space-y-6">
                  <h3 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.tabDatabase', 'Database Updates')}</h3>

                  {proposalsLoading ? (
                    <div className="text-center py-8 text-sm text-text-muted">{t('officerTaskDetail.proposalsLoading', 'Loading pending proposals...')}</div>
                  ) : proposals.length === 0 ? (
                    <div className="gov-card p-8 text-center border border-gov-border">
                      <FileText className="w-8 h-8 mx-auto text-text-muted mb-3" />
                      <h4 className="font-heading font-bold text-sm text-text-heading">
                        {t('officerTaskDetail.noProposalsHeading', 'No Pending Database Updates')}
                      </h4>
                      <p className="text-xs text-text-secondary mt-1">
                        {t('officerTaskDetail.noProposalsDesc', 'No field changes are awaiting your approval at this time.')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {proposals.map((proposal) => (
                        <ProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          isProcessing={approvalMutation.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'decision' && (
                <div className="space-y-4">
                  <h3 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.tabDecision', 'Task Resolution')}</h3>
                  <p className="text-xs text-text-secondary">{t('officerTaskDetail.decisionHelp', 'Select a decision and provide remarks.')}</p>
                  <div className="flex gap-3 flex-wrap">
                    {DECISION_TYPES.map((d) => (
                      <label key={d} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} className="radio" />
                        <span className="font-medium">{d.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                  <textarea value={decisionRemarks} onChange={(e) => setDecisionRemarks(e.target.value)} placeholder={t('officerTaskDetail.remarksPlaceholder', 'Enter decision remarks (required)')} className={`w-full px-3 py-2 border rounded-lg text-sm resize-none ${decisionRemarksError ? 'border-red-500' : 'border-gov-border'}`} rows={3} />
                  {decisionRemarksError && (
                    <p className="text-xs text-red-600">{decisionRemarksError}</p>
                  )}
                  <button onClick={handleResolve} disabled={!decision || resolveMutation.isPending} className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-900 hover:bg-brand-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    {resolveMutation.isPending ? t('officerTaskDetail.resolving', 'Resolving...') : t('officerTaskDetail.submitDecision', 'Submit Decision')}
                  </button>

                  {task.status === 'COMPLETED' && (
                    <div className="pt-4 border-t border-gov-border">
                      <h4 className="font-heading font-bold text-sm text-text-heading mb-3">{t('officerTaskDetail.decisionDocumentsHeading', 'Decision Documents (§49)')}</h4>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => downloadPdf(`/cases/${caseId}/documents/decision-order`, `decision-order-${caseId.slice(0, 8)}.pdf`)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gov-border text-text-secondary hover:bg-surface-2 transition flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          {t('officerTaskDetail.downloadDecisionOrder', 'Download Decision Order')}
                        </button>
                        <button
                          onClick={() => downloadPdf(`/cases/${caseId}/documents/verification-report`, `verification-report-${caseId.slice(0, 8)}.pdf`)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gov-border text-text-secondary hover:bg-surface-2 transition flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          {t('officerTaskDetail.downloadVerificationReport', 'Download Verification Report')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficerTaskDetailModal;
