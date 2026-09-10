import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Inbox,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  ROR_COPY_REQUEST: 'Certified RoR / 7-12 Extract',
  CORRECTION_REQUEST: 'Record Correction Request',
  DISPUTE_FILING: 'Land Dispute & Boundary Grievance',
  DOCUMENT_VERIFICATION_REQUEST: 'Document & Encumbrance Verification',
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const RequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  // Which request cards are expanded to show full detail - department-by-
  // department officer remarks (WorkflowStep.remarks, mandatory on every
  // decision) are already returned by GET /workflows/mine but otherwise
  // never rendered; a citizen had no way to see why a request was
  // approved/rejected. Collapsed by default so a long request list still
  // scans quickly - remarks/request text can run long.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['my-workflows'],
    async () => (await apiService.get('/workflows/mine')).data,
  );

  const pendingCount = workflows.filter(
    (w) => w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS'
  ).length;
  const approvedCount = workflows.filter((w) => w.currentStatus === 'APPROVED').length;
  const rejectedCount = workflows.filter((w) => w.currentStatus === 'REJECTED').length;

  const filtered = workflows.filter((w) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS';
    return w.currentStatus === filter;
  });

  return (
    <div className="space-y-6 animate-fade-up max-w-5xl">
      {/* Header */}
      <div className="pb-4 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-action-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4" />
            <span>Workflow Lifecycle Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            {t('citizenPortal.requestsHeading', 'My Applications')}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Track multi-department review pipelines, officer remarks, and certified digital outputs.
          </p>
        </div>

        <Link
          to="/citizen/raise-request"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider text-white transition shadow-sm hover:shadow active:scale-98 self-start sm:self-auto"
          style={{ background: 'var(--action-600)' }}
        >
          <Send className="w-3.5 h-3.5" />
          File New Request
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`p-3 rounded-xl border text-left transition ${
            filter === 'ALL'
              ? 'bg-brand-900 text-white border-brand-900'
              : 'gov-card hover:border-brand-700'
          }`}
        >
          <span className="text-[11px] font-mono uppercase block opacity-80">Total Filed</span>
          <span className="text-2xl font-heading font-bold">{workflows.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('PENDING')}
          className={`p-3 rounded-xl border text-left transition ${
            filter === 'PENDING'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'gov-card hover:border-amber-500'
          }`}
        >
          <span className="text-[11px] font-mono uppercase block opacity-80">Under Review</span>
          <span className="text-2xl font-heading font-bold text-action-700">
            {pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('APPROVED')}
          className={`p-3 rounded-xl border text-left transition ${
            filter === 'APPROVED'
              ? 'bg-green-700 text-white border-green-700'
              : 'gov-card hover:border-green-600'
          }`}
        >
          <span className="text-[11px] font-mono uppercase block opacity-80">Approved</span>
          <span className="text-2xl font-heading font-bold text-gov-success">
            {approvedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('REJECTED')}
          className={`p-3 rounded-xl border text-left transition ${
            filter === 'REJECTED'
              ? 'bg-red-700 text-white border-red-700'
              : 'gov-card hover:border-red-600'
          }`}
        >
          <span className="text-[11px] font-mono uppercase block opacity-80">Rejected</span>
          <span className="text-2xl font-heading font-bold text-gov-error">
            {rejectedCount}
          </span>
        </button>
      </div>

      {/* Workflow Items List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-text-muted">Loading your requests…</div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 text-red-800 text-sm border border-red-200">
          Error retrieving workflow status.
        </div>
      ) : filtered.length === 0 ? (
        <div className="gov-card p-12 text-center bg-surface-2 border border-gov-border">
          <Inbox className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <h3 className="font-heading font-bold text-base text-text-heading">
            No applications match this filter
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Switch tabs or submit a new revenue department application.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((w) => {
            const isApproved = w.currentStatus === 'APPROVED';
            const isPending = w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS';
            const isRejected = w.currentStatus === 'REJECTED';
            const expanded = expandedIds.has(w.id);

            return (
              <div
                key={w.id}
                className="gov-card p-5 border border-gov-border transition hover:shadow-md space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-text-muted">
                        APPLICATION #{w.id.substring(0, 8)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          isApproved
                            ? 'bg-green-100 text-green-800'
                            : isPending
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {isApproved && <CheckCircle2 className="w-3 h-3" />}
                        {isPending && <Clock className="w-3 h-3" />}
                        {isRejected && <AlertCircle className="w-3 h-3" />}
                        {w.currentStatus}
                      </span>
                    </div>

                    <h3 className="text-base font-heading font-bold text-text-heading mt-1">
                      {WORKFLOW_TYPE_LABELS[w.workflowType] || w.workflowType.replace(/_/g, ' ')}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-text-secondary mt-1 font-mono">
                      <span>Parcel: #{w.parcelId.substring(0, 8)}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(w.createdAt)}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/parcels/${w.parcelId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
                  >
                    View Parcel 360° <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Steps Pipeline */}
                {w.steps && w.steps.length > 0 && (
                  <div className="pt-3 border-t border-gov-border">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-2 font-semibold">
                      Department Interoperability Reviews ({w.steps.length} checkpoints)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {w.steps.map((step) => {
                        const stepDone = step.status === 'APPROVED';
                        const stepFail = step.status === 'REJECTED';
                        return (
                          <div
                            key={step.id}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                              stepDone
                                ? 'bg-green-50/60 border-green-200 text-green-900'
                                : stepFail
                                ? 'bg-red-50/60 border-red-200 text-red-900'
                                : 'bg-surface-2 border-gov-border text-text-secondary'
                            }`}
                          >
                            <span className="font-medium truncate pr-2">
                              {step.department.replace(/_/g, ' ')}
                            </span>
                            <span className="font-mono text-[10px] uppercase font-bold shrink-0">
                              {step.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpanded(w.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wide text-brand-700 hover:text-brand-900 transition"
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('citizenPortal.requestsHideDetailsCta')}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      {t('citizenPortal.requestsViewDetailsCta')}
                    </>
                  )}
                </button>

                {expanded && (
                  <div className="pt-3 border-t border-gov-border space-y-3">
                    {w.requestDetails && (
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-text-muted mb-1">
                          {t('citizenPortal.requestsYourRequestLabel')}
                        </p>
                        <p className="text-xs text-text-secondary whitespace-pre-wrap">{w.requestDetails}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {w.steps.map((step) => (
                        <div key={step.id} className="bg-surface-2 border border-gov-border rounded-lg p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-text-heading">{step.department.replace(/_/g, ' ')}</span>
                            <span className="font-mono text-[10px] uppercase font-bold text-text-secondary">{step.status}</span>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-1.5">
                            <span className="font-mono font-bold uppercase tracking-wide text-text-muted">
                              {t('citizenPortal.requestsOfficerRemarksLabel')}:{' '}
                            </span>
                            {step.remarks || t('citizenPortal.requestsNoRemarksYet')}
                          </p>
                          {step.completedAt && (
                            <p className="text-[10px] text-text-muted mt-1">
                              {t('citizenPortal.requestsDecidedOnLabel', { date: formatDateTime(step.completedAt) })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {w.lastRemarks && (
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-text-muted mb-1">
                          {t('citizenPortal.requestsOverallNoteLabel')}
                        </p>
                        <p className="text-xs text-text-secondary whitespace-pre-wrap">{w.lastRemarks}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
