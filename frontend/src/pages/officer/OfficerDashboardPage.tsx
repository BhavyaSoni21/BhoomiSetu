import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle2,
  ShieldAlert,
  FileCheck2,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Inbox,
  User,
  Calendar,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';
import { useAuthUser } from '../../features/auth/auth';
import { OfficerRole, ROLE_LABELS } from '../../features/officer/officerAuth';

// Not every department has a governance-alert type that maps to it
// (backend's governance_alerts_service.py's _ALERT_TYPE_DEPARTMENT only
// covers LAND_RECORDS/RESTRICTION/TAX/DISPUTE) - showing the alerts card
// for REGISTRATION/PLANNING/ENCUMBRANCE would just always read 0 and
// mislead. BACKLOG.md item 26's DEPARTMENT_DASHBOARD_CONFIG.
const DEPARTMENT_HAS_ALERTS: Record<string, boolean> = {
  LAND_RECORDS: true,
  RESTRICTION: true,
  TAX: true,
  DISPUTE: true,
  REGISTRATION: false,
  PLANNING: false,
  ENCUMBRANCE: false,
};

// Endpoint + column config per department's own "what needs my attention"
// widget - each reads a mock department record the officer's role already
// owns (backend/app/routers/departments.py's new staff-gated list routes),
// distinct from the generic pending-workflow queue below since these
// departments (TAX, PLANNING, REGISTRATION) aren't tied to a workflow
// pipeline at all.
interface DepartmentWidgetConfig {
  endpoint: string;
  headingKey: string;
  emptyKey: string;
  columns: { key: string; labelKey: string; render: (row: any) => React.ReactNode }[];
}

const DEPARTMENT_WIDGETS: Record<string, DepartmentWidgetConfig> = {
  TAX: {
    endpoint: '/tax/overdue',
    headingKey: 'officerDashboard.overdueTaxHeading',
    emptyKey: 'officerDashboard.overdueTaxEmpty',
    columns: [
      { key: 'parcelId', labelKey: 'officerDashboard.tableColParcelId', render: (r) => r.parcelId.slice(0, 10) },
      { key: 'outstandingAmount', labelKey: 'officerDashboard.outstandingAmountLabel', render: (r) => `₹${Number(r.outstandingAmount).toLocaleString()}` },
      { key: 'lastPaymentDate', labelKey: 'officerDashboard.lastPaymentDateLabel', render: (r) => r.lastPaymentDate ?? '—' },
    ],
  },
  PLANNING: {
    endpoint: '/planning/pending-permissions',
    headingKey: 'officerDashboard.pendingPermissionsHeading',
    emptyKey: 'officerDashboard.pendingPermissionsEmpty',
    columns: [
      { key: 'parcelId', labelKey: 'officerDashboard.tableColParcelId', render: (r) => r.parcelId.slice(0, 10) },
      { key: 'landUse', labelKey: 'officerDashboard.landUseLabel', render: (r) => r.landUse.replace(/_/g, ' ') },
      { key: 'zoningClassification', labelKey: 'officerDashboard.zoningLabel', render: (r) => r.zoningClassification },
    ],
  },
  REGISTRATION: {
    endpoint: '/registration/pending',
    headingKey: 'officerDashboard.pendingRegistrationsHeading',
    emptyKey: 'officerDashboard.pendingRegistrationsEmpty',
    columns: [
      { key: 'parcelId', labelKey: 'officerDashboard.tableColParcelId', render: (r) => r.parcelId.slice(0, 10) },
      { key: 'lastTransactionType', labelKey: 'officerDashboard.transactionTypeLabel', render: (r) => r.lastTransactionType ?? '—' },
      { key: 'lastTransactionDate', labelKey: 'officerDashboard.transactionDateLabel', render: (r) => r.lastTransactionDate ?? '—' },
    ],
  },
};

const DepartmentFocusWidget: React.FC<{ department: string }> = ({ department }) => {
  const { t } = useTranslation();
  const config = DEPARTMENT_WIDGETS[department];
  const { data: rows = [], isLoading } = useQuery<any[]>(
    ['department-focus', department],
    async () => (await apiService.get(config.endpoint)).data,
    { enabled: !!config },
  );

  if (!config) return null;

  return (
    <div className="gov-card p-6">
      <h3 className="font-heading font-bold text-lg text-text-heading mb-5">{t(config.headingKey)}</h3>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center rounded-xl bg-surface-2 border border-gov-border">
          <CheckCircle2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
          <p className="text-sm font-semibold text-text-heading">{t(config.emptyKey)}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                {config.columns.map((col) => (
                  <th key={col.key} className="pb-3 font-semibold">{t(col.labelKey)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gov-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-2/60 transition-colors">
                  {config.columns.map((col) => (
                    <td key={col.key} className="py-3 font-mono text-text-primary">{col.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function isToday(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

interface OfficerDashboardPageProps {
  department: string;
}

const OfficerDashboardPage: React.FC<OfficerDashboardPageProps> = ({ department }) => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();

  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['officer-workflows', department],
    async () => (await apiService.get('/workflows', { params: { department } })).data,
  );

  const showAlertsCard = DEPARTMENT_HAS_ALERTS[department] ?? false;

  const { data: alerts = [] } = useQuery<any[]>(
    ['governance-alerts', 'OPEN'],
    async () => {
      const response = await apiService.get('/governance-alerts', { params: { status: 'OPEN' } });
      return response.data;
    },
    { enabled: showAlertsCard },
  );

  const myStepOf = (workflow: Workflow) => workflow.steps.find((s) => s.department === department);
  const pendingWorkflows = workflows.filter((w) => myStepOf(w)?.status === 'PENDING');
  const decidedSteps = workflows.map(myStepOf).filter((s) => s && (s.status === 'APPROVED' || s.status === 'REJECTED'));
  const verifiedToday = decidedSteps.filter((s) => isToday(s!.completedAt)).length;

  return (
    <div className="space-y-8 animate-fade-up max-w-7xl">
      {/* ── Officer Command Header ── */}
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 30px rgba(var(--color-ink), 0.12)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold"
                style={{ background: 'rgba(var(--action-500), 0.2)', color: 'var(--action-500)', border: '1px solid rgba(var(--action-500), 0.4)' }}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                {t('officerDashboard.officialDeskBadge')} · {ROLE_LABELS[user?.role as OfficerRole] ?? t('officerDashboard.defaultRoleLabel')}
              </span>
              <span className="text-white/40 text-xs hidden sm:inline">|</span>
              <span className="text-white/80 text-xs font-mono">
                {t('officerDashboard.departmentLabel')}: {department.replace(/_/g, ' ')}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-heading font-bold text-white tracking-tight">
              {t('officerDashboard.consoleHeadingPrefix')}: {user?.name || t('officerDashboard.defaultOfficerName')}
            </h1>
            <p className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed">
              {t('officerDashboard.consoleSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Key Operational Metrics ── */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showAlertsCard ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('officerDashboard.pendingAdjudicationLabel')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-action-500/15 text-action-700">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-action-700">
              {isLoading ? '...' : pendingWorkflows.length}
            </span>
            <span className="text-xs font-mono text-action-700 font-semibold">{t('officerDashboard.casesAwaitingAction')}</span>
          </div>
          <Link
            to="/officer/requests"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-action-700 hover:text-action-600 transition"
          >
            {t('officerDashboard.reviewQueueLink')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('officerDashboard.totalDecidedLabel')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-900/10 text-brand-900">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {isLoading ? '...' : decidedSteps.length}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">{t('officerDashboard.signedOrdersLabel')}</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
            {t('officerDashboard.cumulativeTotalLabel')}
          </span>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('officerDashboard.processedTodayLabel')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100 text-gov-success">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {isLoading ? '...' : verifiedToday}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">{t('officerDashboard.todaysThroughputLabel')}</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
            {t('officerDashboard.withinSlaLabel')}
          </span>
        </div>

        {showAlertsCard && (
          <div className="gov-card p-5 transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t('officerDashboard.openAlertsLabel')}
              </span>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-100 text-gov-error">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-heading font-bold text-gov-error">
                {alerts.length}
              </span>
              <span className="text-xs font-mono text-gov-error font-semibold">{t('officerDashboard.encroachmentOverlapsLabel')}</span>
            </div>
            <Link
              to="/officer/alerts"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gov-error hover:underline transition"
            >
              {t('officerDashboard.investigateAlertsLink')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* ── Action Queue Table ── */}
      <div className="gov-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-heading font-bold text-lg text-text-heading">
              {t('officerDashboard.pendingCasesQueueHeading')}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {t('officerDashboard.pendingCasesQueueDesc')}
            </p>
          </div>
          <Link
            to="/officer/requests"
            className="text-xs font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
          >
            {t('officerDashboard.openFullDeskLink')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
        ) : pendingWorkflows.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
            <CheckCircle2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
            <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.allCasesAdjudicated')}</p>
            <p className="text-xs text-text-secondary mt-1">
              {t('officerDashboard.noBacklogDesc')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColAppNo')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColParcelId')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColRequestType')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColStatus')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColSubmittedDate')}</th>
                  <th className="pb-3 font-semibold text-right">{t('officerDashboard.tableColAdjudicate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gov-border">
                {pendingWorkflows.slice(0, 6).map((w) => (
                  <tr key={w.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 font-mono font-medium text-text-heading">
                      #{w.id.slice(0, 8)}
                    </td>
                    <td className="py-3 font-mono text-text-primary">
                      {w.parcelId.slice(0, 10)}
                    </td>
                    <td className="py-3 font-medium text-text-primary">
                      {w.workflowType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-amber-100 text-amber-900">
                        {t('officerDashboard.pendingYourReviewBadge')}
                      </span>
                    </td>
                    <td className="py-3 text-text-secondary font-mono">
                      {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : t('officerDashboard.recentFallback')}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/officer/requests?workflow=${w.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition"
                      >
                        {t('officerDashboard.actionButton')} <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {DEPARTMENT_WIDGETS[department] && <DepartmentFocusWidget department={department} />}
    </div>
  );
};

export default OfficerDashboardPage;
