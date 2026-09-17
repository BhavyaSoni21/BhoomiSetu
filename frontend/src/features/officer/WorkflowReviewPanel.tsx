import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X as XIcon, AlertCircle, AlertTriangle, MapPinned, RotateCcw, MapPin, UserCheck } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow, WorkflowStep, VerificationPrecheck, FieldEvidence } from '../../types/workflow';
import { ParcelDocument } from '../../types/parcelDocument';
import { Parcel360Response } from '../../types/parcel360';
import { ManagedUser } from '../../types/user';
import AuthenticatedDocumentImage from '../parcels/AuthenticatedDocumentImage';
import MicButton from '../../components/MicButton';

interface WorkflowReviewPanelProps {
  workflowId: string;
  // Omit for Admin "any department" oversight (AdminWorkflowOversightPage.tsx)
  // - an Admin may decide any still-PENDING step regardless of department
  // (WorkflowsController.reviewStep has no department restriction for
  // ADMIN), so every pending step gets its own review form instead of just
  // the one matching a single officer's department.
  officerDepartment?: string;
}

// LAND_CLAIM_REQUEST/DOCUMENT_VERIFICATION_REQUEST are the two workflow
// types that come with the parcel's stored papers + an automatic OCR
// pre-check (WorkflowsService.buildVerificationPrecheck) - every other
// workflowType has neither.
const VERIFICATION_WORKFLOW_TYPES = new Set(['LAND_CLAIM_REQUEST', 'DOCUMENT_VERIFICATION_REQUEST']);

const PRECHECK_VERDICT_STYLES: Record<string, string> = {
  MATCHED: 'bg-primary/15 text-primary border-primary/50',
  PARTIAL_MATCH: 'bg-accent/20 text-secondary-strong border-accent/50',
  MISMATCH: 'bg-secondary/15 text-secondary-strong border-secondary/50',
  NO_DOCUMENT_ON_FILE: 'bg-muted text-ink/50 border-ink/20',
};

function parsePrecheck(value: string | null): VerificationPrecheck | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as VerificationPrecheck;
  } catch {
    return null;
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN');
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// A department only ever gets to decide its own step (WorkflowsController.
// reviewStep's FORBIDDEN_WRONG_DEPARTMENT check), so the case review panel
// should only surface that same department's own parcel record here -
// mirrors Parcel360View.tsx's per-tab field lists, not imported from there
// since that component isn't built for reuse (this codebase's usual
// duplicate-small-things-rather-than-share convention).
const DEPARTMENT_360_KEY: Record<string, keyof Parcel360Response['departments']> = {
  LAND_RECORDS: 'landRecords',
  REGISTRATION: 'registration',
  PLANNING: 'planning',
  TAX: 'tax',
  RESTRICTION: 'restriction',
  DISPUTE: 'dispute',
  ENCUMBRANCE: 'encumbrance',
};

function DepartmentRecordField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs py-1">
      <span className="text-ink/50 uppercase tracking-wide">{label}</span>
      <span className="text-ink font-semibold text-right">{value}</span>
    </div>
  );
}

function DepartmentRecordFields({ department, departments }: { department: string; departments: Parcel360Response['departments'] }) {
  const { t } = useTranslation();
  switch (department) {
    case 'LAND_RECORDS': {
      const record = departments.landRecords;
      if (!record) return null;
      return (
        <>
          <DepartmentRecordField label={t('parcel360.field.sourceSchema')} value={record.sourceSchema} />
          <DepartmentRecordField label={t('parcel360.field.sourceIdentifier')} value={record.sourceIdentifier} />
          <DepartmentRecordField label={t('parcel360.field.ownerName')} value={record.ownerName} />
          <DepartmentRecordField label={t('parcel360.area')} value={`${record.areaSqM.toLocaleString()} m²`} />
          <DepartmentRecordField label={t('parcel360.field.locality')} value={record.locality} />
        </>
      );
    }
    case 'REGISTRATION': {
      const record = departments.registration;
      if (!record) return null;
      return (
        <>
          <DepartmentRecordField label={t('verificationCard.status')} value={record.registrationStatus} />
          <DepartmentRecordField label={t('parcel360.field.registrationNumber')} value={record.registrationNumber || t('common.notApplicable')} />
          <DepartmentRecordField label={t('parcel360.field.registrationDate')} value={formatDate(record.registrationDate)} />
          <DepartmentRecordField label={t('parcel360.field.lastTransaction')} value={record.lastTransactionType || t('common.notApplicable')} />
          <DepartmentRecordField label={t('parcel360.field.lastTransactionDate')} value={formatDate(record.lastTransactionDate)} />
        </>
      );
    }
    case 'PLANNING': {
      const record = departments.planning;
      if (!record) return null;
      return (
        <>
          <DepartmentRecordField label={t('parcel360.field.landUse')} value={record.landUse} />
          <DepartmentRecordField label={t('parcel360.field.zoningClassification')} value={record.zoningClassification} />
          <DepartmentRecordField label={t('parcel360.field.masterPlanReference')} value={record.masterPlanReference} />
          <DepartmentRecordField label={t('parcel360.field.buildingPermission')} value={record.buildingPermissionStatus} />
        </>
      );
    }
    case 'TAX': {
      const record = departments.tax;
      if (!record) return null;
      return (
        <>
          <DepartmentRecordField label={t('parcel360.field.assessedValue')} value={formatCurrency(record.assessedValue)} />
          <DepartmentRecordField label={t('parcel360.field.annualTax')} value={formatCurrency(record.annualTaxAmount)} />
          <DepartmentRecordField label={t('parcel360.field.taxStatus')} value={record.taxStatus} />
          <DepartmentRecordField label={t('parcel360.field.outstandingAmount')} value={formatCurrency(record.outstandingAmount)} />
          <DepartmentRecordField label={t('parcel360.field.lastPaymentDate')} value={formatDate(record.lastPaymentDate)} />
        </>
      );
    }
    case 'RESTRICTION': {
      const record = departments.restriction;
      if (!record) return null;
      return (
        <>
          <DepartmentRecordField label={t('parcel360.field.hasRestriction')} value={record.hasRestriction ? t('common.yes') : t('common.no')} />
          {record.hasRestriction && (
            <>
              <DepartmentRecordField label={t('parcel360.field.restrictionType')} value={record.restrictionType || t('common.notApplicable')} />
              <DepartmentRecordField label={t('parcel360.field.details')} value={record.restrictionDetails || t('common.notApplicable')} />
              <DepartmentRecordField label={t('parcel360.field.imposingAuthority')} value={record.imposingAuthority || t('common.notApplicable')} />
            </>
          )}
        </>
      );
    }
    case 'DISPUTE': {
      const record = departments.dispute;
      if (!record) return null;
      return (
        <>
          <DepartmentRecordField label={t('parcel360.field.hasActiveDispute')} value={record.hasActiveDispute ? t('common.yes') : t('common.no')} />
          <DepartmentRecordField label={t('parcel360.field.disputeType')} value={record.disputeType || t('common.notApplicable')} />
          <DepartmentRecordField label={t('parcel360.field.caseStatus')} value={record.caseStatus || t('common.notApplicable')} />
          <DepartmentRecordField label={t('parcel360.field.filingDate')} value={formatDate(record.filingDate)} />
        </>
      );
    }
    case 'ENCUMBRANCE': {
      const record = departments.encumbrance;
      if (!record) return null;
      return (
        <>
          <DepartmentRecordField label={t('parcel360.field.hasEncumbrance')} value={record.hasEncumbrance ? t('common.yes') : t('common.no')} />
          {record.hasEncumbrance && (
            <>
              <DepartmentRecordField label={t('parcel360.field.encumbranceType')} value={record.encumbranceType || t('common.notApplicable')} />
              <DepartmentRecordField label={t('parcel360.field.lenderName')} value={record.lenderName || t('common.notApplicable')} />
              <DepartmentRecordField label={t('parcel360.field.instrumentReference')} value={record.instrumentReference || t('common.notApplicable')} />
            </>
          )}
        </>
      );
    }
    default:
      return null;
  }
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

interface StepReviewFormProps {
  workflowId: string;
  step: WorkflowStep;
}

const StepReviewForm: React.FC<StepReviewFormProps> = ({ workflowId, step }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  const reviewMutation = useMutation(
    async (action: 'APPROVE' | 'REJECT') => {
      const response = await apiService.patch(`/workflows/${workflowId}/steps/${step.id}`, {
        action,
        remarks: remarks.trim(),
      });
      return response.data as Workflow;
    },
    {
      onSuccess: () => {
        setRemarks('');
        queryClient.invalidateQueries(['workflow', workflowId]);
        queryClient.invalidateQueries(['officer-workflows']);
        queryClient.invalidateQueries(['admin-workflows']);
      },
    },
  );

  const remarksId = `review-remarks-${step.id}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={remarksId} className="block text-xs font-bold uppercase tracking-widest text-ink">
          {t('officerPortal.remarksRequiredLabel')}
        </label>
        <MicButton
          onResult={(text) => setRemarks((prev) => (prev ? `${prev} ${text}` : text))}
        />
      </div>
      <textarea
        id={remarksId}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink focus:outline-none focus:border-primary"
        rows={3}
        placeholder={t('officerPortal.remarksPlaceholder')}
      />
      <p className="text-xs text-ink/50 mt-1">
        {t('officerPortal.remarksHelperText')}
      </p>
      {reviewMutation.isError && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong mt-1">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('officerPortal.reviewSubmitError')}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => reviewMutation.mutate('APPROVE')}
          disabled={reviewMutation.isLoading || !remarks.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          {t('officerPortal.approveCta')}
        </button>
        <button
          onClick={() => reviewMutation.mutate('REJECT')}
          disabled={reviewMutation.isLoading || !remarks.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          <XIcon className="w-4 h-4" aria-hidden="true" />
          {t('officerPortal.rejectCta')}
        </button>
      </div>
    </div>
  );
};

interface EscalateStepFormProps {
  workflowId: string;
  step: WorkflowStep;
  onCancel: () => void;
}

// Admin oversight "alert the officers" action (docs/ADMIN_PANEL_ISSUES.md
// Coming Soon #2 follow-up, per the user's explicit "the admin dont have to
// approve the workflow... he can alert the officers for checking on some
// case at the earliest") - notifies whoever holds the step's assignedRole
// without deciding it. POST /workflows/:id/steps/:stepId/escalate never
// touches step.status.
const EscalateStepForm: React.FC<EscalateStepFormProps> = ({ workflowId, step, onCancel }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');

  const escalateMutation = useMutation(async () => {
    const response = await apiService.post(`/workflows/${workflowId}/steps/${step.id}/escalate`, {
      message: message.trim(),
    });
    return response.data as Workflow;
  });

  const fieldId = `escalate-message-${step.id}`;
  const roleLabel = step.assignedRole.replace(/_/g, ' ');

  if (escalateMutation.isSuccess) {
    return (
      <div className="mt-2 border-2 border-primary/50 bg-primary/10 p-3 flex items-center justify-between gap-2">
        <p className="text-sm text-ink flex items-center gap-1.5">
          <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          {t('officerPortal.alertSentTo', { role: roleLabel })}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-xs font-bold uppercase tracking-wider text-ink/60 hover:text-ink"
        >
          {t('officerPortal.closeCta')}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 border-2 border-accent/60 bg-accent/10 p-3">
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={fieldId} className="block text-xs font-bold uppercase tracking-widest text-ink">
          {t('officerPortal.escalateMessageLabel', { role: roleLabel })}
        </label>
        <MicButton
          onResult={(text) => setMessage((prev) => (prev ? `${prev} ${text}` : text))}
        />
      </div>
      <textarea
        id={fieldId}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink focus:outline-none focus:border-primary"
        rows={2}
        placeholder={t('officerPortal.escalateMessagePlaceholder')}
      />
      {escalateMutation.isError && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong mt-1">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('officerPortal.escalateSubmitError')}
        </p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => escalateMutation.mutate()}
          disabled={escalateMutation.isLoading || !message.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-ink font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          {t('officerPortal.sendAlertCta')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 border-2 border-ink text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          {t('officerPortal.cancelCta')}
        </button>
      </div>
    </div>
  );
};

interface AdminStepRowProps {
  workflowId: string;
  step: WorkflowStep;
}

type AdminStepMode = 'idle' | 'escalate' | 'decide';

// One row per still-pending step in Admin oversight mode. Monitoring is the
// default - an Admin isn't expected to decide a step just because they can
// (WorkflowsController.reviewStep has no department restriction for ADMIN,
// but that's a capability, not an expectation). "Alert Officer" is the
// primary action; "Decide Myself" is an explicit opt-in for when there's a
// genuine issue the Admin wants to resolve directly.
const AdminStepRow: React.FC<AdminStepRowProps> = ({ workflowId, step }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AdminStepMode>('idle');

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70">{step.department.replace(/_/g, ' ')}</h4>
        {mode === 'idle' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('escalate')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-ink bg-accent text-ink font-bold text-[10px] uppercase tracking-widest hover:bg-accent/80 transition"
            >
              <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              {t('officerPortal.alertOfficerCta')}
            </button>
            <button
              type="button"
              onClick={() => setMode('decide')}
              className="px-2.5 py-1 border-2 border-ink/30 text-ink/60 font-bold text-[10px] uppercase tracking-widest hover:border-ink hover:text-ink transition"
            >
              {t('officerPortal.decideMyselfCta')}
            </button>
          </div>
        )}
      </div>
      {mode === 'escalate' && <EscalateStepForm workflowId={workflowId} step={step} onCancel={() => setMode('idle')} />}
      {mode === 'decide' && (
        <div className="mt-2">
          <StepReviewForm workflowId={workflowId} step={step} />
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="mt-2 text-[10px] font-bold uppercase tracking-widest text-ink/50 hover:text-ink underline underline-offset-2"
          >
            {t('officerPortal.cancelJustMonitor')}
          </button>
        </div>
      )}
    </div>
  );
};

interface ReopenStepFormProps {
  workflowId: string;
  step: WorkflowStep;
  onCancel: () => void;
}

// Admin oversight "send back for re-review" action - the counterpart to
// EscalateStepForm above, but for a step that's ALREADY been decided
// (APPROVED/REJECTED). Unlike escalate, this actually resets the step back
// to PENDING (WorkflowsService.reopenStep) so the responsible officer has to
// re-examine and re-decide it, rather than just being nudged about it.
const ReopenStepForm: React.FC<ReopenStepFormProps> = ({ workflowId, step, onCancel }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const reopenMutation = useMutation(
    async () => {
      const response = await apiService.post(`/workflows/${workflowId}/steps/${step.id}/reopen`, {
        message: message.trim(),
      });
      return response.data as Workflow;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['workflow', workflowId]);
        queryClient.invalidateQueries(['officer-workflows']);
        queryClient.invalidateQueries(['admin-workflows']);
      },
    },
  );

  const fieldId = `reopen-message-${step.id}`;
  const roleLabel = step.assignedRole.replace(/_/g, ' ');

  return (
    <div className="mt-2 border-2 border-secondary/60 bg-secondary/10 p-3">
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={fieldId} className="block text-xs font-bold uppercase tracking-widest text-ink">
          {t('officerPortal.reopenMessageLabel', { role: roleLabel })}
        </label>
        <MicButton
          onResult={(text) => setMessage((prev) => (prev ? `${prev} ${text}` : text))}
        />
      </div>
      <textarea
        id={fieldId}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink focus:outline-none focus:border-primary"
        rows={2}
        placeholder={t('officerPortal.reopenMessagePlaceholder')}
      />
      {reopenMutation.isError && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong mt-1">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('officerPortal.reopenSubmitError')}
        </p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => reopenMutation.mutate()}
          disabled={reopenMutation.isLoading || !message.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('officerPortal.sendBackCta')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 border-2 border-ink text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          {t('officerPortal.cancelCta')}
        </button>
      </div>
    </div>
  );
};

interface AdminDecidedStepRowProps {
  workflowId: string;
  step: WorkflowStep;
}

type AdminDecidedStepMode = 'idle' | 'reopen';

// One row per already-decided step in Admin oversight mode - lets an Admin
// flag a decision that needs a second look back to the officer who made it,
// so they have to re-calibrate it rather than it standing unquestioned.
const AdminDecidedStepRow: React.FC<AdminDecidedStepRowProps> = ({ workflowId, step }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AdminDecidedStepMode>('idle');

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70">{step.department.replace(/_/g, ' ')}</h4>
          <span className={statusBadgeClass(step.status)}>{step.status}</span>
        </div>
        {mode === 'idle' && (
          <button
            type="button"
            onClick={() => setMode('reopen')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-ink bg-secondary/15 text-secondary-strong font-bold text-[10px] uppercase tracking-widest hover:bg-secondary/25 transition"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            {t('officerPortal.sendBackForReviewCta')}
          </button>
        )}
      </div>
      {mode === 'reopen' && <ReopenStepForm workflowId={workflowId} step={step} onCancel={() => setMode('idle')} />}
    </div>
  );
};

// Admin-only (PATCH /workflows/{id}/assign-verifier requires ADMIN) - hands
// this workflow off to an Authorized Field Verifier for a site visit.
// Reuses the same admin-users listing UserManagement.tsx is built on
// (GET /users), filtered client-side to just the VERIFIER role rather than
// adding a new lower-privilege listing endpoint.
const AssignVerifierControl: React.FC<{ workflowId: string; assignedVerifierId: string | null; requiresFieldVerification: boolean }> = ({
  workflowId,
  assignedVerifierId,
  requiresFieldVerification,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery<ManagedUser[]>(['admin-users'], async () => (await apiService.get('/users')).data);
  const verifiers = users.filter((u) => u.role === 'VERIFIER');

  const assignMutation = useMutation(
    async (verifierId: string) => (await apiService.patch(`/workflows/${workflowId}/assign-verifier`, { verifierId })).data as Workflow,
    { onSuccess: () => queryClient.invalidateQueries(['workflow', workflowId]) },
  );

  const assignedVerifier = verifiers.find((v) => v.id === assignedVerifierId);

  return (
    <div className="border-t-4 border-ink pt-4">
      <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1.5 flex items-center gap-1.5">
        <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
        {t('officerPortal.assignVerifierLabel')}
      </h4>
      {!requiresFieldVerification && !assignedVerifier && (
        <p className="text-xs text-ink/50 mb-1.5">{t('officerPortal.verificationNotTypicallyNeeded')}</p>
      )}
      {assignedVerifier && <p className="text-sm text-ink mb-1.5">{t('officerPortal.currentlyAssignedTo', { name: assignedVerifier.name })}</p>}
      <select
        value={assignedVerifierId ?? ''}
        onChange={(e) => e.target.value && assignMutation.mutate(e.target.value)}
        disabled={assignMutation.isLoading || verifiers.length === 0}
        className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary disabled:opacity-50"
      >
        <option value="" disabled>
          {verifiers.length === 0 ? t('officerPortal.noVerifiersAvailable') : t('officerPortal.selectVerifierPlaceholder')}
        </option>
        {verifiers.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
    </div>
  );
};

// Every field-visit evidence item a Verifier has submitted for this
// workflow - photo, GPS, who captured it and when. Shown to staff before a
// review decision is made (docs/SIH26014_Hidden_Insights_Strategy.md §3-4).
const FieldEvidenceSection: React.FC<{ workflowId: string }> = ({ workflowId }) => {
  const { t } = useTranslation();
  const { data: evidence = [] } = useQuery<FieldEvidence[]>(
    ['field-evidence', workflowId],
    async () => (await apiService.get(`/workflows/${workflowId}/field-evidence`)).data,
  );

  if (evidence.length === 0) return null;

  return (
    <div className="border-t-4 border-ink pt-4">
      <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1.5 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
        {t('officerPortal.fieldEvidenceLabel')}
      </h4>
      <div className="flex flex-wrap gap-3">
        {evidence.map((item) => (
          <div key={item.id} className="w-32">
            <AuthenticatedDocumentImage
              src={`/workflows/${workflowId}/field-evidence/${item.id}/photo`}
              alt={t('officerPortal.fieldEvidenceAlt')}
              className="w-32 h-40 object-cover border-2 border-ink"
              zoomable
            />
            <p className="mt-1 text-[10px] font-mono text-ink/70">{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</p>
            <p className="text-[10px] text-ink/50">{formatDate(item.capturedAt)}</p>
            {item.notes && <p className="text-[10px] text-ink/60 italic mt-0.5">&quot;{item.notes}&quot;</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

const WorkflowReviewPanel: React.FC<WorkflowReviewPanelProps> = ({ workflowId, officerDepartment }) => {
  const { t } = useTranslation();
  const { data: workflow, isLoading, error } = useQuery<Workflow>(
    ['workflow', workflowId],
    async () => {
      const response = await apiService.get(`/workflows/${workflowId}`);
      return response.data;
    },
  );

  const isVerificationType = !!workflow && VERIFICATION_WORKFLOW_TYPES.has(workflow.workflowType);

  const { data: documents = [] } = useQuery<ParcelDocument[]>(
    ['parcel-documents', workflow?.parcelId],
    async () => (await apiService.get(`/parcels/${workflow!.parcelId}/documents`)).data,
    { enabled: isVerificationType },
  );

  // Case review is scoped to the reviewing officer's own department - fetched
  // only in officer mode (Admin oversight has no single department to scope
  // to, and already has the full "View Parcel" link below for a complete
  // picture).
  const { data: parcel360 } = useQuery<Parcel360Response>(
    ['parcel-360-for-review', workflow?.parcelId],
    async () => (await apiService.get(`/parcels/${workflow!.parcelId}/360`)).data,
    { enabled: !!workflow && !!officerDepartment },
  );

  if (isLoading) return <div className="text-ink/60 text-sm">{t('officerPortal.loadingWorkflow')}</div>;
  if (error || !workflow) return <div className="text-ink/60 text-sm">{t('officerPortal.errorLoadingWorkflow')}</div>;

  const isAdminMode = !officerDepartment;
  const myStep = officerDepartment ? workflow.steps.find((s) => s.department === officerDepartment) : undefined;
  const canReview = !isAdminMode && myStep?.status === 'PENDING';
  const pendingStepsForAdmin = isAdminMode ? workflow.steps.filter((s) => s.status === 'PENDING') : [];
  const decidedStepsForAdmin = isAdminMode ? workflow.steps.filter((s) => s.status === 'APPROVED' || s.status === 'REJECTED') : [];
  const precheck = parsePrecheck(workflow.verificationPrecheck);
  const departmentRecordKey = officerDepartment ? DEPARTMENT_360_KEY[officerDepartment] : undefined;
  const hasDepartmentRecord = !!departmentRecordKey && !!parcel360?.departments?.[departmentRecordKey];

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1">{t('officerPortal.applicantLabel')}</h4>
        <p className="text-sm text-ink">{workflow.createdBy ?? t('officerPortal.unknownLabel')}</p>
        {workflow.applicantContact && <p className="text-sm text-ink/60">{workflow.applicantContact}</p>}
        {workflow.applicantAddress && <p className="text-sm text-ink/60">{workflow.applicantAddress}</p>}
      </div>

      {(isVerificationType || workflow.evidenceFileName) && (
        <div className="border-t-4 border-ink pt-4 space-y-3">
          {isVerificationType && (
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1.5">{t('officerPortal.landPropertyPapersLabel')}</h4>
              {documents.length === 0 ? (
                <p className="text-sm text-ink/50">{t('officerPortal.noDocumentOnFile')}</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="w-28">
                      <AuthenticatedDocumentImage
                        src={`/parcels/${workflow.parcelId}/documents/${doc.id}/file`}
                        alt={doc.documentType}
                        className="w-28 h-36 object-cover border-2 border-ink"
                        zoomable
                      />
                      <span className="mt-1 block text-center border-2 border-ink/20 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink/70">
                        {doc.registrationStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {workflow.evidenceFileName && (
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1.5">{t('officerPortal.submittedEvidenceLabel')}</h4>
              <p className="text-xs text-ink/50 mb-1.5">{t('officerPortal.attachedByApplicant')}</p>
              <div className="w-28">
                <AuthenticatedDocumentImage
                  src={`/workflows/${workflow.id}/evidence`}
                  alt={t('officerPortal.submittedEvidenceAlt')}
                  className="w-28 h-36 object-cover border-2 border-ink"
                  zoomable
                />
              </div>
              {workflow.evidenceAuthenticitySuspicious && (
                <div className="mt-2 inline-flex items-start gap-1.5 border-2 border-secondary-strong bg-secondary/10 px-2 py-1.5 max-w-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-secondary-strong shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-[11px] text-ink/80">
                    {t('officerPortal.authenticitySuspiciousLabel')}
                    {(() => {
                      try {
                        const reasons = workflow.evidenceAuthenticityReasons ? (JSON.parse(workflow.evidenceAuthenticityReasons) as string[]) : [];
                        return reasons.length > 0 ? ` (${reasons.join(', ').replace(/_/g, ' ').toLowerCase()})` : '';
                      } catch {
                        return '';
                      }
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}

          {precheck && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70">
                  {t('officerPortal.automaticPrecheckLabel', 'OCR & Ownership Pre-Check')}
                </h4>
                {(precheck as any).match_percent !== undefined && (
                  <span className="text-xs font-mono font-bold text-brand-900">
                    Match: {(precheck as any).match_percent}%
                  </span>
                )}
              </div>
              <span className={`inline-block border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${PRECHECK_VERDICT_STYLES[precheck.verdict] ?? 'bg-muted text-ink/70 border-ink/20'}`}>
                {precheck.verdict.replace(/_/g, ' ')}
              </span>

              {(precheck as any).field_results || (precheck as any).fieldResults ? (
                <div className="mt-3 border-2 border-ink bg-surface overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b-2 border-ink bg-muted text-[10px] font-mono uppercase text-ink/70">
                        <th className="py-2 px-3 font-bold">Field</th>
                        <th className="py-2 px-3 font-bold">Entered Value</th>
                        <th className="py-2 px-3 font-bold">Document Value</th>
                        <th className="py-2 px-3 font-bold text-center">✓</th>
                        <th className="py-2 px-3 font-bold text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/10">
                      {((precheck as any).field_results || (precheck as any).fieldResults).map((r: any) => (
                        <tr key={r.field} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-medium capitalize">{r.label || r.field.replace(/_/g, ' ')}</td>
                          <td className="py-2 px-3 font-mono">{r.user || '—'}</td>
                          <td className="py-2 px-3 font-mono text-ink/70">{r.doc || '—'}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${r.match ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary-strong'}`}>
                              {r.match ? '✅' : '❌'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {(r.score * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : precheck.checks && precheck.checks.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {precheck.checks.map((check) => (
                    <div key={check.field} className="flex items-center justify-between text-xs text-ink/70">
                      <span>{check.field.replace(/_/g, ' ')}: {check.expectedValue}</span>
                      <span className={`font-bold ${check.status === 'MATCHED' ? 'text-primary' : 'text-secondary-strong'}`}>{check.status}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">{workflow.workflowType.replace(/_/g, ' ')}</h3>
        <p className="text-sm text-ink/60 flex items-center gap-1.5 flex-wrap">
          {workflow.parcelId}
          {/* Notifications stopped auto-opening Parcel 360 (docs/ADMIN_PANEL_ISSUES.md
              follow-up), so this is now the direct path from a request's
              review back to its parcel's full detail view - still fully
              reachable, just not the automatic landing spot any more. */}
          <Link
            to={`/parcels/${workflow.parcelId}`}
            className="inline-flex items-center gap-1 text-primary hover:text-primary-strong font-bold text-xs uppercase tracking-wide underline underline-offset-2"
          >
            <MapPinned className="w-3.5 h-3.5" aria-hidden="true" />
            {t('officerPortal.viewParcelCta')}
          </Link>
        </p>
        <span className={`mt-1 ${statusBadgeClass(workflow.currentStatus)}`}>
          {workflow.currentStatus}
        </span>
        {workflow.requestDetails && <p className="text-sm text-ink/70 mt-2 italic">&quot;{workflow.requestDetails}&quot;</p>}
      </div>

      {isAdminMode && (
        <AssignVerifierControl
          workflowId={workflowId}
          assignedVerifierId={workflow.assignedVerifierId}
          requiresFieldVerification={workflow.requiresFieldVerification}
        />
      )}
      <FieldEvidenceSection workflowId={workflowId} />

      {/* Scoped to the reviewing officer's own department only (never the
          other 6 departments' records) - the case review panel's job is
          "does this department's own data support the decision", not a full
          Parcel 360 browse. */}
      {officerDepartment && (
        <div className="border-t-4 border-ink pt-4">
          <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1.5">
            {officerDepartment.replace(/_/g, ' ')} {t('officerPortal.departmentRecordLabel')}
          </h4>
          {hasDepartmentRecord ? (
            <div className="border-2 border-ink divide-y divide-ink/10 px-3">
              <DepartmentRecordFields department={officerDepartment} departments={parcel360!.departments} />
            </div>
          ) : (
            <p className="text-sm text-ink/50">{t('officerPortal.noDepartmentRecordOnFile')}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70">{t('officerPortal.reviewStepsLabel')}</h4>
        <div className="border-2 border-ink divide-y-2 divide-ink">
          {workflow.steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm bg-surface">
              <div>
                <span className="font-bold text-ink">{step.department.replace(/_/g, ' ')}</span>
                <span className="text-ink/60"> ({step.assignedRole.replace(/_/g, ' ')})</span>
                {step.remarks && <p className="text-ink/60 text-xs mt-0.5">{t('officerPortal.stepRemarksLabel', { text: step.remarks })}</p>}
                {step.completedAt && <p className="text-ink/50 text-xs">{t('officerPortal.decidedLabel', { date: formatDate(step.completedAt) })}</p>}
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
          <StepReviewForm workflowId={workflowId} step={myStep!} />
        </div>
      ) : isAdminMode && (pendingStepsForAdmin.length > 0 || decidedStepsForAdmin.length > 0) ? (
        <div className="border-t-4 border-ink pt-4 space-y-4">
          {pendingStepsForAdmin.length > 0 && (
            <div className="space-y-4 divide-y-2 divide-ink/10">
              <p className="text-xs text-ink/50">
                {t('officerPortal.adminMonitoringHint')}
              </p>
              {pendingStepsForAdmin.map((step, index) => (
                <div key={step.id} className={index > 0 ? 'pt-4' : undefined}>
                  <AdminStepRow workflowId={workflowId} step={step} />
                </div>
              ))}
            </div>
          )}
          {decidedStepsForAdmin.length > 0 && (
            <div className={`space-y-4 divide-y-2 divide-ink/10 ${pendingStepsForAdmin.length > 0 ? 'border-t-4 border-ink/10 pt-4' : ''}`}>
              <p className="text-xs text-ink/50">
                {t('officerPortal.adminReopenHint')}
              </p>
              {decidedStepsForAdmin.map((step, index) => (
                <div key={step.id} className={index > 0 ? 'pt-4' : undefined}>
                  <AdminDecidedStepRow workflowId={workflowId} step={step} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink/60 border-t-4 border-ink pt-4">
          {isAdminMode
            ? t('officerPortal.allStepsDecided')
            : myStep
              ? t('officerPortal.departmentAlreadyDecided')
              : t('officerPortal.noStepForDepartment')}
        </p>
      )}
    </div>
  );
};

export default WorkflowReviewPanel;
