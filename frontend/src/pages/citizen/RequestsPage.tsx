import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Inbox, Send } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-muted text-ink/70 border-ink/20',
  IN_PROGRESS: 'bg-primary/10 text-primary border-primary/40',
  APPROVED: 'bg-primary/15 text-primary border-primary/50',
  REJECTED: 'bg-secondary/15 text-secondary-strong border-secondary/50',
};

const STEP_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-muted text-ink/60 border-ink/20',
  APPROVED: 'bg-primary/15 text-primary border-primary/50',
  REJECTED: 'bg-secondary/15 text-secondary-strong border-secondary/50',
};

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  ROR_COPY_REQUEST: 'Record of Rights (RoR) copy request',
  CORRECTION_REQUEST: 'Correction request',
  DISPUTE_FILING: 'Dispute filing',
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

// The aggregated cross-parcel request list (docs/FRONTEND_UPGRADE_SPEC.md
// §4's "Requests" page and dashboard placeholder card's target) - backed by
// the new GET /workflows/mine endpoint (workflows.controller.ts), which
// rolls up every workflow across every parcel in the citizen's own
// citizen_parcels links. Per-department step status is shown per request
// (steps[] the backend already returns); a genuinely separate, structured
// per-department *notification feed* is still the distinct, not-yet-built
// thing docs/FRONTEND_UPGRADE_SPEC.md §4 calls "Notifications".
const RequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['my-workflows'],
    async () => (await apiService.get('/workflows/mine')).data,
  );
  // Which request cards are expanded to show full detail - department-by-
  // department officer remarks (WorkflowStep.remarks, mandatory on every
  // decision) were already returned by GET /workflows/mine but never
  // rendered anywhere; a citizen had no way to see why a request was
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

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink mb-1">
        {t('citizenPortal.requestsHeading')}
      </h1>
      <p className="text-xs text-ink/60 mb-5">{t('citizenPortal.requestsDesc')}</p>

      {isLoading ? (
        <p className="text-sm text-ink/60">{t('citizenPortal.requestsLoading')}</p>
      ) : error ? (
        <p className="text-sm font-medium text-secondary-strong">{t('citizenPortal.requestsError')}</p>
      ) : workflows.length === 0 ? (
        <div className="bg-surface border-2 border-ink/20 p-5 flex items-start gap-3">
          <Inbox className="w-5 h-5 text-ink/40 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm text-ink/70 mb-3">{t('citizenPortal.requestsEmpty')}</p>
            <Link
              to="/citizen/raise-request"
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              {t('citizenNav.raiseRequest')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow) => {
            const expanded = expandedIds.has(workflow.id);
            return (
              <div key={workflow.id} className="bg-surface border-2 border-ink shadow-hard-sm p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-bold text-ink">
                    {WORKFLOW_TYPE_LABELS[workflow.workflowType] ?? workflow.workflowType.replace(/_/g, ' ')}
                  </p>
                  <span
                    className={`border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${
                      STATUS_COLORS[workflow.currentStatus] ?? 'bg-muted text-ink/70 border-ink/20'
                    }`}
                  >
                    {workflow.currentStatus}
                  </span>
                </div>
                <p className="text-xs text-ink/40 mb-3">
                  Parcel: {workflow.parcelId} · Submitted {formatDate(workflow.createdAt)}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {workflow.steps.map((step) => (
                    <span
                      key={step.id}
                      className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        STEP_STATUS_COLORS[step.status] ?? 'bg-muted text-ink/60 border-ink/20'
                      }`}
                    >
                      {step.department.replace(/_/g, ' ')}: {step.status}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpanded(workflow.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary hover:underline"
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
                  <div className="mt-3 pt-3 border-t border-ink/15 space-y-3">
                    {workflow.requestDetails && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-ink/50 mb-1">
                          {t('citizenPortal.requestsYourRequestLabel')}
                        </p>
                        <p className="text-xs text-ink/80 whitespace-pre-wrap">{workflow.requestDetails}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {workflow.steps.map((step) => (
                        <div key={step.id} className="bg-muted/40 border border-ink/15 p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-ink">{step.department.replace(/_/g, ' ')}</span>
                            <span
                              className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                STEP_STATUS_COLORS[step.status] ?? 'bg-muted text-ink/60 border-ink/20'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink/60 mt-1.5">
                            <span className="font-bold uppercase tracking-wide text-ink/50">
                              {t('citizenPortal.requestsOfficerRemarksLabel')}:{' '}
                            </span>
                            {step.remarks || t('citizenPortal.requestsNoRemarksYet')}
                          </p>
                          {step.completedAt && (
                            <p className="text-[10px] text-ink/40 mt-1">
                              {t('citizenPortal.requestsDecidedOnLabel', { date: formatDateTime(step.completedAt) })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {workflow.lastRemarks && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-ink/50 mb-1">
                          {t('citizenPortal.requestsOverallNoteLabel')}
                        </p>
                        <p className="text-xs text-ink/80 whitespace-pre-wrap">{workflow.lastRemarks}</p>
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
