import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie,
} from 'recharts';
import {
  Loader2, Map as MapIcon, Workflow, AlertTriangle, Gavel, CircleCheck,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { AnalyticsSummary, Distribution } from '../../types/analytics';
import { useTranslation } from '../../context/LanguageContext';

// ── Formatting helpers (presentation only - never touches the data itself) ──

// "NOT_REGISTERED" -> "Not Registered", "ROR_COPY_REQUEST" -> "RoR Copy Request".
function formatEnumLabel(key: string): string {
  const titleCased = key
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return titleCased.replace(/\bRor\b/, 'RoR');
}

function sumCounts(data: Distribution[]): number {
  return data.reduce((sum, d) => sum + d.count, 0);
}

function pct(count: number, total: number): number | null {
  return total > 0 ? Math.round((count / total) * 100) : null;
}

function countFor(data: Distribution[], key: string): number {
  return data.find((d) => d.key === key)?.count ?? 0;
}

// Reorders a distribution to follow a known pipeline/lifecycle sequence
// (e.g. Submitted -> In Progress -> Approved/Rejected) instead of whatever
// order the backend's GROUP BY happened to return - any key not in the
// known sequence (there shouldn't be any) is kept, appended at the end,
// rather than silently dropped.
function orderByStages(data: Distribution[], stageOrder: string[]): Distribution[] {
  const byKey = new Map(data.map((d) => [d.key, d]));
  const ordered: Distribution[] = [];
  for (const stage of stageOrder) {
    const entry = byKey.get(stage);
    if (entry) {
      ordered.push(entry);
      byKey.delete(stage);
    }
  }
  return [...ordered, ...byKey.values()];
}

// ── Semantic color (communicates meaning - red/amber/green read as
// worse/caution/better at a glance, not just decoration) - literal hex since
// recharts' SVG rendering can't resolve CSS custom properties. Categorical
// data with no inherent "good/bad" (land use, request type) instead cycles
// through the brand's own earth-tone palette. ──
const RED = '#dc2626';
const AMBER = '#d97706';
const BLUE = '#2563eb';
const GREEN = '#16a34a';
const ORANGE = '#ea580c';
const SLATE = '#64748b';
const BRAND_PALETTE = ['#1b4332', '#935116', '#e8963c', '#52b788', '#7c3f1d', '#c68b59'];
const CHART_MUTED = '#7a7a72';

const TAX_STATUS_COLORS: Record<string, string> = { OVERDUE: RED, PENDING: AMBER, PAID: GREEN };
const REGISTRATION_STATUS_COLORS: Record<string, string> = { NOT_REGISTERED: RED, PENDING: AMBER, REGISTERED: GREEN };
const WORKFLOW_STATUS_COLORS: Record<string, string> = { SUBMITTED: BLUE, IN_PROGRESS: AMBER, APPROVED: GREEN, REJECTED: RED };
const DISPUTE_STATUS_COLORS: Record<string, string> = { FILED: BLUE, UNDER_REVIEW: AMBER, RESOLVED: GREEN, DISMISSED: SLATE };
const ALERT_SEVERITY_COLORS: Record<string, string> = { LOW: GREEN, MEDIUM: AMBER, HIGH: ORANGE, CRITICAL: RED };
// Same vocabulary as the Governance Alerts panel's own 4-stage stepper
// (features/officer/GovernanceAlertReasonPrompt.tsx) so "OPEN" reads as
// "Detected" everywhere in the app, not just here.
const ALERT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Detected', ACKNOWLEDGED: 'Acknowledged', FIELD_VERIFIED: 'Field Verified', RESOLVED: 'Resolved', DISMISSED: 'Dismissed',
};
const ALERT_STATUS_COLORS: Record<string, string> = { OPEN: RED, ACKNOWLEDGED: AMBER, FIELD_VERIFIED: BLUE, RESOLVED: GREEN, DISMISSED: SLATE };

function colorFor(key: string, map: Record<string, string>, fallbackIndex: number): string {
  return map[key] ?? BRAND_PALETTE[fallbackIndex % BRAND_PALETTE.length];
}

// ── Shared building blocks ──

const CardShell: React.FC<{ title: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({ title, subtitle, className, children }) => (
  <div className={`rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ${className ?? ''}`}>
    <h3 className="text-sm font-bold text-ink">{title}</h3>
    {subtitle && <p className="text-xs text-ink/50 mt-0.5 mb-3">{subtitle}</p>}
    {!subtitle && <div className="mb-3" />}
    {children}
  </div>
);

const KpiCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: 'neutral' | 'good' | 'warn';
  hint?: string;
}> = ({ icon: Icon, label, value, tone = 'neutral', hint }) => {
  const toneClasses = {
    neutral: 'text-ink bg-ink/5',
    good: 'text-emerald-700 bg-emerald-50',
    warn: 'text-amber-700 bg-amber-50',
  }[tone];
  return (
    <div className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${toneClasses}`}>
        <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 mb-1">{label}</p>
      <p className="text-3xl font-bold text-ink tabular-nums">{value.toLocaleString('en-IN')}</p>
      {hint && <p className="text-xs text-ink/50 mt-1">{hint}</p>}
    </div>
  );
};

const EmptyState: React.FC = () => <p className="text-xs text-ink/40 py-8 text-center">No data</p>;

// Ranking / comparison across categories - horizontal bars so long labels
// (e.g. "Document Verification Request") get a full line each instead of
// being rotated and clipped. Value printed at the end of each bar instead
// of relying on gridlines to estimate magnitude.
const RankedBarChart: React.FC<{
  data: Distribution[];
  colorFor: (key: string, index: number) => string;
  formatLabel?: (key: string) => string;
  sort?: boolean;
}> = ({ data, colorFor: getColor, formatLabel = formatEnumLabel, sort = false }) => {
  if (data.length === 0) return <EmptyState />;
  const rows = sort ? [...data].sort((a, b) => b.count - a.count) : data;
  const height = Math.max(rows.length * 40, 80);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="key"
          tickFormatter={formatLabel}
          tick={{ fontSize: 12, fill: CHART_MUTED }}
          width={140}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [value, 'Count']}
          labelFormatter={(label: string) => formatLabel(label)}
          contentStyle={{ background: '#f5f6f2', border: '2px solid #0a1a13', borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: '#0a1a13', fontWeight: 700 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {rows.map((row, i) => (
            <Cell key={row.key} fill={getColor(row.key, i)} />
          ))}
          <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#0a1a13' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Part-to-whole with a small number of meaningful categories - paired with a
// legend table (count + %) since a donut alone makes exact values hard to
// read, and a headline compliance rate for the one category that represents
// "done"/"good" (paid, registered, ...).
const ComplianceDonut: React.FC<{
  data: Distribution[];
  colors: Record<string, string>;
  goodKey: string;
  goodLabel: string;
}> = ({ data, colors, goodKey, goodLabel }) => {
  if (data.length === 0) return <EmptyState />;
  const total = sumCounts(data);
  const goodPct = pct(countFor(data, goodKey), total);
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="key" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={d.key} fill={colorFor(d.key, colors, i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-ink tabular-nums">{goodPct ?? '—'}%</span>
          <span className="text-[9px] text-ink/50 text-center leading-tight px-1">{goodLabel}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 min-w-0">
        {data.map((d, i) => (
          <li key={d.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorFor(d.key, colors, i) }} aria-hidden="true" />
              <span className="text-ink/70 truncate">{formatEnumLabel(d.key)}</span>
            </span>
            <span className="font-semibold text-ink shrink-0 tabular-nums">
              {d.count} <span className="text-ink/40 font-normal">({pct(d.count, total) ?? 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Small, ordinal categorical set - four compact severity tiles read faster
// than a bar chart when the point is "how many CRITICAL alerts right now",
// not a shape comparison.
const SeverityTiles: React.FC<{ data: Distribution[] }> = ({ data }) => {
  if (data.length === 0) return <EmptyState />;
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const rows = orderByStages(data, order);
  const toneClasses: Record<string, string> = {
    LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
    CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {rows.map((d) => (
        <div key={d.key} className={`rounded-lg border px-3 py-2.5 ${toneClasses[d.key] ?? 'bg-ink/5 text-ink border-ink/10'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{formatEnumLabel(d.key)}</p>
          <p className="text-xl font-bold tabular-nums">{d.count}</p>
        </div>
      ))}
    </div>
  );
};

const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery<AnalyticsSummary>(['analytics-summary'], async () => {
    const response = await apiService.get('/analytics/summary');
    return response.data;
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {t('analyticsDashboard.loading')}
      </div>
    );
  }
  if (error || !data) return <div className="text-sm font-medium text-ink/60 py-3">{t('analyticsDashboard.error')}</div>;

  const workflowStatusOrdered = orderByStages(data.workflowStatusDistribution, ['SUBMITTED', 'IN_PROGRESS', 'APPROVED', 'REJECTED']);
  const disputeStatusOrdered = orderByStages(data.disputeCaseStatusDistribution, ['FILED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']);
  const alertStatusOrdered = orderByStages(data.alertStatusDistribution, ['OPEN', 'ACKNOWLEDGED', 'FIELD_VERIFIED', 'RESOLVED', 'DISMISSED']);

  const decidedWorkflows = countFor(data.workflowStatusDistribution, 'APPROVED') + countFor(data.workflowStatusDistribution, 'REJECTED');
  const approvalRate = pct(countFor(data.workflowStatusDistribution, 'APPROVED'), decidedWorkflows);

  return (
    <div className="space-y-6">
      {/* Top-level KPIs - the numbers an admin checks first. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={MapIcon} label={t('analyticsDashboard.kpi.totalParcels')} value={data.totals.parcels} />
        <KpiCard icon={Workflow} label={t('analyticsDashboard.kpi.totalWorkflows')} value={data.totals.workflows} />
        <KpiCard
          icon={AlertTriangle}
          label={t('analyticsDashboard.kpi.openAlerts')}
          value={data.totals.openAlerts}
          tone={data.totals.openAlerts > 0 ? 'warn' : 'good'}
          hint={data.totals.openAlerts === 0 ? t('analyticsDashboard.kpi.allClear') : t('analyticsDashboard.kpi.awaitingReview')}
        />
        <KpiCard icon={Gavel} label={t('analyticsDashboard.kpi.activeDisputes')} value={data.totals.activeDisputes} tone={data.totals.activeDisputes > 0 ? 'warn' : 'good'} />
      </div>

      {/* Main insight - the operational question this whole system tracks:
          are citizen requests actually moving through review, and how are
          they being decided. */}
      <CardShell
        title={t('analyticsDashboard.charts.workflowPipeline.title')}
        subtitle={t('analyticsDashboard.charts.workflowPipeline.subtitle')}
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="flex-1 min-w-0">
            <RankedBarChart data={workflowStatusOrdered} colorFor={(key, i) => colorFor(key, WORKFLOW_STATUS_COLORS, i)} />
          </div>
          {approvalRate !== null && (
            <div className="sm:w-40 shrink-0 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
              <CircleCheck className="w-4 h-4 text-emerald-700 mx-auto mb-1" aria-hidden="true" />
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{approvalRate}%</p>
              <p className="text-[11px] text-emerald-700/80 mt-0.5">of decided requests approved</p>
            </div>
          )}
        </div>
      </CardShell>

      {/* Secondary analytics - compliance first (most actionable for an
          admin), then composition/ranking breakdowns. */}
      <div className="grid gap-5 md:grid-cols-2">
        <CardShell title={t('analyticsDashboard.charts.taxCompliance.title')} subtitle={t('analyticsDashboard.charts.taxCompliance.subtitle')}>
          <ComplianceDonut data={data.taxStatusDistribution} colors={TAX_STATUS_COLORS} goodKey="PAID" goodLabel="Paid" />
        </CardShell>
        <CardShell title={t('analyticsDashboard.charts.registrationCompliance.title')} subtitle={t('analyticsDashboard.charts.registrationCompliance.subtitle')}>
          <ComplianceDonut data={data.registrationStatusDistribution} colors={REGISTRATION_STATUS_COLORS} goodKey="REGISTERED" goodLabel="Registered" />
        </CardShell>

        <CardShell title={t('analyticsDashboard.charts.disputeResolution.title')} subtitle={t('analyticsDashboard.charts.disputeResolution.subtitle')}>
          <RankedBarChart data={disputeStatusOrdered} colorFor={(key, i) => colorFor(key, DISPUTE_STATUS_COLORS, i)} />
        </CardShell>
        <CardShell title={t('analyticsDashboard.charts.alertsByStage.title')} subtitle={t('analyticsDashboard.charts.alertsByStage.subtitle')}>
          <RankedBarChart data={alertStatusOrdered} colorFor={(key, i) => colorFor(key, ALERT_STATUS_COLORS, i)} formatLabel={(k) => ALERT_STATUS_LABELS[k] ?? formatEnumLabel(k)} />
        </CardShell>

        <CardShell title={t('analyticsDashboard.charts.landUse.title')} subtitle={t('analyticsDashboard.charts.landUse.subtitle')}>
          <RankedBarChart data={data.landUseDistribution} colorFor={(key, i) => colorFor(key, {}, i)} sort />
        </CardShell>
        <CardShell title={t('analyticsDashboard.charts.requestTypes.title')} subtitle={t('analyticsDashboard.charts.requestTypes.subtitle')}>
          <RankedBarChart data={data.workflowTypeDistribution} colorFor={(key, i) => colorFor(key, {}, i)} sort />
        </CardShell>

        <CardShell title={t('analyticsDashboard.charts.alertsBySeverity.title')} subtitle={t('analyticsDashboard.charts.alertsBySeverity.subtitle')} className="md:col-span-2">
          <SeverityTiles data={data.alertSeverityDistribution} />
        </CardShell>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
