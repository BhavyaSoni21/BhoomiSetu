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
  MapPin,
  Upload,
  Radio,
  FileText,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Shield,
  Gavel,
  Building2,
  Search,
  Flag,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';
import { useAuthUser } from '../../features/auth/auth';
import DemoDataBadge from '../../components/DemoDataBadge';
import { OfficerRole, ROLE_LABELS } from '../../features/officer/officerAuth';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';

// Graphical summary of a department's live data - a status pie (from the
// officer's own workflow queue) + a bar of the department's key numeric
// metrics. Non-numeric stat values (e.g. TAX's "₹12.5L") are skipped so the
// bar chart stays honest. Request B: "dashboard of each department must be a
// graphical representation of the data".
const STATUS_COLORS = ['#f59e0b', '#10b981', '#ef4444']; // pending / approved / rejected

const DepartmentCharts: React.FC<{
  statusData: { name: string; value: number }[];
  metricData: { name: string; value: number }[];
}> = ({ statusData, metricData }) => {
  const hasStatus = statusData.some((d) => d.value > 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="gov-card p-6">
        <h3 className="font-heading font-bold text-lg text-text-heading mb-4">Case Status Breakdown</h3>
        {hasStatus ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-sm text-text-muted">No cases in your queue yet.</div>
        )}
      </div>
      <div className="gov-card p-6">
        <h3 className="font-heading font-bold text-lg text-text-heading mb-4">Department Metrics</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={metricData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--brand-700, #047857)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

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
  SURVEY: true,
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
      { key: 'lastPaymentDate', labelKey: 'officerDashboard.lastPaymentDateLabel', render: (r) => r.lastPaymentDate ?? '-' },
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
      { key: 'lastTransactionType', labelKey: 'officerDashboard.transactionTypeLabel', render: (r) => r.lastTransactionType ?? '-' },
      { key: 'lastTransactionDate', labelKey: 'officerDashboard.transactionDateLabel', render: (r) => r.lastTransactionDate ?? '-' },
    ],
  },
  SURVEY: {
    endpoint: '/survey/pending',
    headingKey: 'officerDashboard.pendingSurveysHeading',
    emptyKey: 'officerDashboard.pendingSurveysEmpty',
    columns: [
      { key: 'parcelId', labelKey: 'officerDashboard.tableColParcelId', render: (r) => r.parcelId.slice(0, 10) },
      { key: 'surveyType', labelKey: 'officerDashboard.tableColSurveyType', render: (r) => r.surveyType?.replace(/_/g, ' ') ?? '-' },
      { key: 'status', labelKey: 'officerDashboard.tableColSurveyStatus', render: (r) => r.status },
      { key: 'measuredArea', labelKey: 'officerDashboard.tableColMeasuredArea', render: (r) => r.measuredArea ? `${r.measuredArea} m²` : '-' },
      { key: 'areaDelta', labelKey: 'officerDashboard.tableColAreaDelta', render: (r) => r.areaDelta !== undefined ? `${r.areaDelta >= 0 ? '+' : ''}${r.areaDelta} m²` : '-' },
      { key: 'geometryUpdated', labelKey: 'officerDashboard.tableColGeometryUpdated', render: (r) => r.geometryUpdated ? '✓' : '✗' },
      { key: 'surveyDate', labelKey: 'officerDashboard.tableColSurveyDate', render: (r) => r.surveyDate ? new Date(r.surveyDate).toLocaleDateString() : '-' },
    ],
  },
};

const DepartmentFocusWidget: React.FC<{ department: string }> = ({ department }) => {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(0);
  const limit = 10;
  
  const config = DEPARTMENT_WIDGETS[department];
  const { data: rows = [], isLoading, isFetching } = useQuery<any[]>(
    ['department-focus', department, page],
    async () => (await apiService.get(config.endpoint, { params: { skip: page * limit, limit } })).data,
    { enabled: !!config, keepPreviousData: true },
  );

  if (!config) return null;

  return (
    <div className="gov-card p-6">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-heading font-bold text-lg text-text-heading">{t(config.headingKey)}</h3>
        {isFetching && <div className="text-xs text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>}
      </div>
      {isLoading && page === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
      ) : rows.length === 0 && page === 0 ? (
        <div className="py-8 text-center rounded-xl bg-surface-2 border border-gov-border">
          <CheckCircle2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
          <p className="text-sm font-semibold text-text-heading">{t(config.emptyKey)}</p>
        </div>
      ) : (
        <div className="space-y-4">
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
                {rows.length === 0 && page > 0 && (
                  <tr>
                    <td colSpan={config.columns.length} className="py-8 text-center text-text-muted">No more records</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isFetching}
              className="px-3 py-1 text-xs font-semibold uppercase tracking-wider border border-gov-border rounded hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-text-muted">Page {page + 1}</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={rows.length < limit || isFetching}
              className="px-3 py-1 text-xs font-semibold uppercase tracking-wider border border-gov-border rounded hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
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

interface DepartmentStats {
  department: string;
  duplicateFlags?: number;
  zoningConflicts?: number;
  overdueParcels?: number;
  reassessmentsPending?: number;
  collectedToday?: number; // rupees
  activeRestrictions?: number;
  blocksTriggered?: number;
  newMortgages?: number;
  fraudPrevented?: number;
  escalatedToCollector?: number;
  evidenceComplete?: number;
  inProgressFieldwork?: number;
  geometryUpdated?: number;
}

function formatRupees(n?: number): string {
  if (n == null) return '-';
  return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString()}`;
}

interface StatsData {
  pendingWorkflows: number;
  decidedSteps: number;
  verifiedToday: number;
  alerts: number;
  isLoading: boolean;
  deptStats?: DepartmentStats;
  statsLoading: boolean;
  withinSla: number;
}

function renderStatsCards(department: string, data: StatsData) {
  const { t } = useTranslation();
  const { pendingWorkflows, decidedSteps, verifiedToday, isLoading, deptStats, statsLoading, withinSla } = data;
  // Metric cards previously hardcoded now read live counts from GET /stats/:code;
  // '...' while loading, 0 if the field is absent, so the UI never crashes.
  const d = (v?: number): number | string => (statsLoading ? '...' : v ?? 0);

  const statsConfig: Record<string, { label: string; value: number | string; icon: React.ReactNode; color: string; bgColor: string; subLabel: string; link?: string }[]> = {
    LAND_RECORDS: [
      { label: t('officerDashboard.pendingMutationsLabel'), value: isLoading ? '...' : pendingWorkflows, icon: <Clock className="w-5 h-5" />, color: 'text-action-700', bgColor: 'bg-action-500/15', subLabel: t('officerDashboard.casesAwaitingAction') },
      { label: t('officerDashboard.totalDecidedLabel'), value: isLoading ? '...' : decidedSteps, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-text-heading', bgColor: 'bg-brand-900/10', subLabel: t('officerDashboard.signedOrdersLabel') },
      { label: t('officerDashboard.processedTodayLabel'), value: isLoading ? '...' : verifiedToday, icon: <FileCheck2 className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.todaysThroughputLabel') },
      { label: t('officerDashboard.withinSlaLabel'), value: isLoading ? '...' : withinSla, icon: <ShieldCheck className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.slaComplianceLabel') },
    ],
    REGISTRATION: [
      { label: t('officerDashboard.pendingRegistrationsLabel'), value: isLoading ? '...' : pendingWorkflows, icon: <FileText className="w-5 h-5" />, color: 'text-action-700', bgColor: 'bg-action-500/15', subLabel: t('officerDashboard.casesAwaitingAction') },
      { label: t('officerDashboard.duplicateFlagsLabel'), value: d(deptStats?.duplicateFlags), icon: <AlertTriangle className="w-5 h-5" />, color: 'text-amber-700', bgColor: 'bg-amber-100', subLabel: t('officerDashboard.flaggedForReviewLabel') },
      { label: t('officerDashboard.approvedTodayLabel'), value: isLoading ? '...' : verifiedToday, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.todaysThroughputLabel') },
      { label: t('officerDashboard.totalDecidedLabel'), value: isLoading ? '...' : decidedSteps, icon: <ShieldCheck className="w-5 h-5" />, color: 'text-brand-900', bgColor: 'bg-brand-900/10', subLabel: t('officerDashboard.cumulativeTotalLabel') },
    ],
    PLANNING: [
      { label: t('officerDashboard.pendingPermissionsLabel'), value: isLoading ? '...' : pendingWorkflows, icon: <MapPin className="w-5 h-5" />, color: 'text-action-700', bgColor: 'bg-action-500/15', subLabel: t('officerDashboard.casesAwaitingAction') },
      { label: t('officerDashboard.zoningConflictsLabel'), value: d(deptStats?.zoningConflicts), icon: <AlertCircle className="w-5 h-5" />, color: 'text-red-700', bgColor: 'bg-red-100', subLabel: t('officerDashboard.requiresAttentionLabel') },
      { label: t('officerDashboard.approvedTodayLabel'), value: isLoading ? '...' : verifiedToday, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.todaysThroughputLabel') },
      { label: t('officerDashboard.totalDecidedLabel'), value: isLoading ? '...' : decidedSteps, icon: <ShieldCheck className="w-5 h-5" />, color: 'text-brand-900', bgColor: 'bg-brand-900/10', subLabel: t('officerDashboard.cumulativeTotalLabel') },
    ],
    TAX: [
      { label: t('officerDashboard.overdueParcelsLabel'), value: d(deptStats?.overdueParcels), icon: <AlertTriangle className="w-5 h-5" />, color: 'text-amber-700', bgColor: 'bg-amber-100', subLabel: t('officerDashboard.outstandingArrearsLabel') },
      { label: t('officerDashboard.reassessmentsPendingLabel'), value: d(deptStats?.reassessmentsPending), icon: <TrendingUp className="w-5 h-5" />, color: 'text-blue-700', bgColor: 'bg-blue-100', subLabel: t('officerDashboard.mutationTriggeredLabel') },
      { label: t('officerDashboard.collectedTodayLabel'), value: statsLoading ? '...' : formatRupees(deptStats?.collectedToday), icon: <DollarSign className="w-5 h-5" />, color: 'text-green-700', bgColor: 'bg-green-100', subLabel: t('officerDashboard.revenueCollectedLabel') },
      { label: t('officerDashboard.withinSlaLabel'), value: isLoading ? '...' : withinSla, icon: <ShieldCheck className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.slaComplianceLabel') },
    ],
    RESTRICTION: [
      { label: t('officerDashboard.flagChangeRequestsLabel'), value: isLoading ? '...' : pendingWorkflows, icon: <Flag className="w-5 h-5" />, color: 'text-action-700', bgColor: 'bg-action-500/15', subLabel: t('officerDashboard.casesAwaitingAction') },
      { label: t('officerDashboard.activeRestrictionsLabel'), value: d(deptStats?.activeRestrictions), icon: <Shield className="w-5 h-5" />, color: 'text-red-700', bgColor: 'bg-red-100', subLabel: t('officerDashboard.currentlyEnforcedLabel') },
      { label: t('officerDashboard.reviewedTodayLabel'), value: isLoading ? '...' : verifiedToday, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.todaysThroughputLabel') },
      { label: t('officerDashboard.blocksTriggeredLabel'), value: d(deptStats?.blocksTriggered), icon: <AlertCircle className="w-5 h-5" />, color: 'text-amber-700', bgColor: 'bg-amber-100', subLabel: t('officerDashboard.transfersBlockedLabel') },
    ],
    ENCUMBRANCE: [
      { label: t('officerDashboard.pendingCertificatesLabel'), value: isLoading ? '...' : pendingWorkflows, icon: <FileCheck2 className="w-5 h-5" />, color: 'text-action-700', bgColor: 'bg-action-500/15', subLabel: t('officerDashboard.casesAwaitingAction') },
      { label: t('officerDashboard.newMortgagesLabel'), value: d(deptStats?.newMortgages), icon: <Building2 className="w-5 h-5" />, color: 'text-blue-700', bgColor: 'bg-blue-100', subLabel: t('officerDashboard.registeredThisPeriodLabel') },
      { label: t('officerDashboard.fraudPreventedLabel'), value: d(deptStats?.fraudPrevented), icon: <ShieldAlert className="w-5 h-5" />, color: 'text-green-700', bgColor: 'bg-green-100', subLabel: t('officerDashboard.blockedByDisputeRestrictionLabel') },
      { label: t('officerDashboard.totalDecidedLabel'), value: isLoading ? '...' : decidedSteps, icon: <ShieldCheck className="w-5 h-5" />, color: 'text-brand-900', bgColor: 'bg-brand-900/10', subLabel: t('officerDashboard.cumulativeTotalLabel') },
    ],
    DISPUTE: [
      { label: t('officerDashboard.activeDisputesLabel'), value: isLoading ? '...' : pendingWorkflows, icon: <Gavel className="w-5 h-5" />, color: 'text-action-700', bgColor: 'bg-action-500/15', subLabel: t('officerDashboard.casesAwaitingAction') },
      { label: t('officerDashboard.escalatedToCollectorLabel'), value: d(deptStats?.escalatedToCollector), icon: <AlertCircle className="w-5 h-5" />, color: 'text-red-700', bgColor: 'bg-red-100', subLabel: t('officerDashboard.highPriorityLabel') },
      { label: t('officerDashboard.resolvedTodayLabel'), value: isLoading ? '...' : verifiedToday, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.todaysThroughputLabel') },
      { label: t('officerDashboard.evidenceCompleteLabel'), value: d(deptStats?.evidenceComplete), icon: <FileCheck2 className="w-5 h-5" />, color: 'text-brand-900', bgColor: 'bg-brand-900/10', subLabel: t('officerDashboard.readyForHearingLabel') },
    ],
    SURVEY: [
      { label: t('officerDashboard.pendingSurveysLabel'), value: isLoading ? '...' : pendingWorkflows, icon: <MapPin className="w-5 h-5" />, color: 'text-action-700', bgColor: 'bg-action-500/15', subLabel: t('officerDashboard.casesAwaitingAction') },
      { label: t('officerDashboard.inProgressFieldworkLabel'), value: d(deptStats?.inProgressFieldwork), icon: <Upload className="w-5 h-5" />, color: 'text-blue-700', bgColor: 'bg-blue-100', subLabel: t('officerDashboard.surveyorsInFieldLabel') },
      { label: t('officerDashboard.completedTodayLabel'), value: isLoading ? '...' : verifiedToday, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-gov-success', bgColor: 'bg-green-100', subLabel: t('officerDashboard.todaysThroughputLabel') },
      { label: t('officerDashboard.geometryUpdatedLabel'), value: d(deptStats?.geometryUpdated), icon: <Radio className="w-5 h-5" />, color: 'text-indigo-700', bgColor: 'bg-indigo-100', subLabel: t('officerDashboard.parcelsGeometrySyncedLabel') },
    ],
  };

  const cards = statsConfig[department] || statsConfig.LAND_RECORDS;

  return cards.map((card, index) => (
    <div key={index} className="gov-card p-5 transition hover:shadow-md">
      <div className="flex items-start justify-between">
        {/* Label + value share one wrapper so each stat reads as a unit. */}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {card.label}
          </span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold">{card.value}</span>
            <span className="text-xs font-mono font-semibold">{card.subLabel}</span>
          </div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.bgColor} ${card.color}`}>
          {card.icon}
        </div>
      </div>
      {card.link && (
        <Link
          to={card.link}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold hover:underline transition"
          style={{ color: card.color }}
        >
          {t('officerDashboard.viewDetailsLink')} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  ));
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

  // Live department metric cards (was hardcoded). See GET /stats/:code.
  const { data: deptStats, isLoading: statsLoading } = useQuery<DepartmentStats>(
    ['department-stats', department],
    async () => (await apiService.get(`/stats/${department}`)).data,
  );

  // Real "Within SLA" count from the officer's own SLA monitor
  // (GET /cases/tasks/my/sla). Replaces the earlier fake decidedSteps*0.85/0.9
  // fudge factor - withinSla = tasks whose SLA timer is still OK (not breached).
  const { data: slaRows = [] } = useQuery<{ sla: { status: string } | null }[]>(
    ['my-tasks-sla'],
    async () => (await apiService.get('/cases/tasks/my/sla')).data,
  );
  const withinSlaCount = slaRows.filter((r) => r.sla?.status === 'OK').length;

  const myStepOf = (workflow: Workflow) => workflow.steps.find((s) => s.department === department);
  const pendingWorkflows = workflows.filter((w) => myStepOf(w)?.status === 'PENDING');
  const decidedSteps = workflows.map(myStepOf).filter((s) => s && (s.status === 'APPROVED' || s.status === 'REJECTED'));
  const verifiedToday = decidedSteps.filter((s) => isToday(s!.completedAt)).length;

  // Department-specific stats - hardcoded constants replaced by live counts
  // from GET /stats/:code (deptStats); workflow-derived fields stay client-side.
  const departmentStats = {
    LAND_RECORDS: { pendingMutations: pendingWorkflows.length, approvedToday: verifiedToday, totalDecided: decidedSteps.length, withinSla: withinSlaCount },
    REGISTRATION: { pendingRegistrations: pendingWorkflows.length, duplicateFlags: deptStats?.duplicateFlags ?? 0, approvedToday: verifiedToday, totalDecided: decidedSteps.length },
    PLANNING: { pendingPermissions: pendingWorkflows.length, zoningConflicts: deptStats?.zoningConflicts ?? 0, approvedToday: verifiedToday, totalDecided: decidedSteps.length },
    TAX: { overdueParcels: deptStats?.overdueParcels ?? 0, reassessmentsPending: deptStats?.reassessmentsPending ?? 0, collectedToday: formatRupees(deptStats?.collectedToday), withinSla: withinSlaCount },
    RESTRICTION: { flagChangeRequests: pendingWorkflows.length, activeRestrictions: deptStats?.activeRestrictions ?? 0, reviewedToday: verifiedToday, blocksTriggered: deptStats?.blocksTriggered ?? 0 },
    ENCUMBRANCE: { pendingCertificates: pendingWorkflows.length, newMortgages: deptStats?.newMortgages ?? 0, fraudPrevented: deptStats?.fraudPrevented ?? 0, totalDecided: decidedSteps.length },
    DISPUTE: { activeDisputes: pendingWorkflows.length, escalatedToCollector: deptStats?.escalatedToCollector ?? 0, resolvedToday: verifiedToday, evidenceComplete: deptStats?.evidenceComplete ?? 0 },
    SURVEY: { pendingSurveys: pendingWorkflows.length, inProgressFieldwork: deptStats?.inProgressFieldwork ?? 0, completedToday: verifiedToday, geometryUpdated: deptStats?.geometryUpdated ?? 0 },
  };

  const stats = departmentStats[department as keyof typeof departmentStats] || departmentStats.LAND_RECORDS;

  // Chart inputs derived from the same live data the cards use.
  const approved = decidedSteps.filter((s) => s!.status === 'APPROVED').length;
  const rejected = decidedSteps.filter((s) => s!.status === 'REJECTED').length;
  const statusData = [
    { name: 'Pending', value: pendingWorkflows.length },
    { name: 'Approved', value: approved },
    { name: 'Rejected', value: rejected },
  ];
  const metricData = Object.entries(stats)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => ({ name: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(), value: v as number }));

  return (
    <div className="space-y-8 animate-fade-up max-w-7xl">
      <div className="flex justify-end -mb-4"><DemoDataBadge /></div>
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
            <span className="sr-only">
              Welcome, {user?.name} ({ROLE_LABELS[user?.role as OfficerRole] ?? t('officerDashboard.defaultRoleLabel')})
            </span>
            <p className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed">
              {t('officerDashboard.consoleSubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Key Operational Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderStatsCards(department, {
          pendingWorkflows: pendingWorkflows.length,
          decidedSteps: decidedSteps.length,
          verifiedToday,
          alerts: alerts.length,
          isLoading,
          deptStats,
          statsLoading,
          withinSla: withinSlaCount,
        })}
      </div>

      {/* ── Graphical Data Summary ── */}
      <DepartmentCharts statusData={statusData} metricData={metricData} />

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
