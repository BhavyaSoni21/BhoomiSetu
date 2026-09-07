import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Loader2, Map, Workflow, AlertTriangle, Gavel } from 'lucide-react';
import apiService from '../../services/apiService';
import { AnalyticsSummary, Distribution } from '../../types/analytics';

// Recharts wants literal color strings on stroke/fill props (CSS variables
// don't resolve inside its SVG rendering), so these are the literal bhoomi.*
// hex values from tailwind.config.js rather than the semantic --color-*
// tokens - see docs/design.md's chart color note. Cycled one-per-chart so
// the 8-chart grid reads as a set rather than 8 identical indigo bars.
const CHART_PALETTE = ['#1b4332', '#935116', '#e8963c', '#52b788', '#7c3f1d', '#c68b59', '#2d6a4f', '#40916c'];
// Neutral tone for grid lines/axis text - legible against both the white
// (light mode) and bhoomi-card (dark mode) card background these charts sit on.
const CHART_MUTED = '#7a7a72';

const DistributionBarChart: React.FC<{ title: string; data: Distribution[]; color: string }> = ({ title, data, color }) => (
  <div className="border-2 border-ink bg-surface p-4">
    <h3 className="text-sm font-bold uppercase tracking-wide text-ink mb-2">{title}</h3>
    {data.length === 0 ? (
      <p className="text-xs text-ink/50">No data</p>
    ) : (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_MUTED} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="key" tick={{ fontSize: 11, fill: CHART_MUTED }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART_MUTED }} />
          <Tooltip
            contentStyle={{ background: '#f5f6f2', border: '2px solid #0a1a13', borderRadius: 0, fontSize: 12 }}
            labelStyle={{ color: '#0a1a13', fontWeight: 700 }}
          />
          <Bar dataKey="count" fill={color} radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

const AnalyticsDashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery<AnalyticsSummary>(['analytics-summary'], async () => {
    const response = await apiService.get('/analytics/summary');
    return response.data;
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Loading analytics...
      </div>
    );
  }
  if (error || !data) return <div className="text-sm font-medium text-ink/60 py-3">Error loading analytics</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Map className="w-4 h-4 text-primary" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">Total Parcels</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{data.totals.parcels}</p>
        </div>
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Workflow className="w-4 h-4 text-secondary" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">Total Workflows</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{data.totals.workflows}</p>
        </div>
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-accent" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">Open Alerts</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{data.totals.openAlerts}</p>
        </div>
        <div className="border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-4 h-4 text-secondary-strong" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink/70">Active Disputes</h3>
          </div>
          <p className="text-2xl font-black font-display text-ink">{data.totals.activeDisputes}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <DistributionBarChart title="Tax Status" data={data.taxStatusDistribution} color={CHART_PALETTE[0]} />
        <DistributionBarChart title="Registration Status" data={data.registrationStatusDistribution} color={CHART_PALETTE[1]} />
        <DistributionBarChart title="Land Use" data={data.landUseDistribution} color={CHART_PALETTE[2]} />
        <DistributionBarChart title="Dispute Case Status" data={data.disputeCaseStatusDistribution} color={CHART_PALETTE[3]} />
        <DistributionBarChart title="Workflow Status" data={data.workflowStatusDistribution} color={CHART_PALETTE[4]} />
        <DistributionBarChart title="Workflow Type" data={data.workflowTypeDistribution} color={CHART_PALETTE[5]} />
        <DistributionBarChart title="Alert Severity" data={data.alertSeverityDistribution} color={CHART_PALETTE[6]} />
        <DistributionBarChart title="Alert Status" data={data.alertStatusDistribution} color={CHART_PALETTE[7]} />
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
