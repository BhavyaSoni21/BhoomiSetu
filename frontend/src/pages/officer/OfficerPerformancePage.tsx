import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import apiService from '../../services/apiService';
import { OfficerMonitoringEntry } from '../../types/analytics';

// Officer's own performance ("Performance" tab, plan §53–55). Same metrics as
// the admin monitoring table but scoped to the signed-in officer via
// GET /analytics/my-performance. Graphical (recharts) per Request B.
const OfficerPerformancePage: React.FC = () => {
  const { data, isLoading, error } = useQuery<OfficerMonitoringEntry>(
    ['my-performance'],
    async () => (await apiService.get('/analytics/my-performance')).data,
  );

  if (isLoading) return <div className="py-12 text-center text-sm text-text-muted">Loading your performance…</div>;
  if (error || !data) {
    return (
      <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
        <p className="text-sm font-semibold text-text-heading">No performance record yet</p>
        <p className="text-xs text-text-secondary mt-1">Decisions you make on cases will start appearing here.</p>
      </div>
    );
  }

  const cards = [
    { label: 'Pending in Queue', value: data.pendingInRoleQueue, color: 'text-amber-600' },
    { label: 'Approved', value: data.approvedCount, color: 'text-emerald-600' },
    { label: 'Rejected', value: data.rejectedCount, color: 'text-red-600' },
    { label: 'Avg Decision (hrs)', value: data.avgDecisionHours ?? '-', color: 'text-brand-700' },
  ];
  const chartData = [
    { name: 'Pending', value: data.pendingInRoleQueue },
    { name: 'Approved', value: data.approvedCount },
    { name: 'Rejected', value: data.rejectedCount },
  ];
  const COLORS = ['#f59e0b', '#10b981', '#ef4444'];

  return (
    <div className="space-y-6 animate-fade-up max-w-5xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-heading">My Performance</h1>
        <p className="text-sm text-text-secondary mt-1">{data.name} · {data.department.replace(/_/g, ' ')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="gov-card p-5">
            <p className="text-xs text-text-muted uppercase font-mono">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="gov-card p-6">
        <h3 className="font-heading font-bold text-lg text-text-heading mb-4">Decisions Overview</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {data.lastActivityAt && (
          <p className="text-xs text-text-muted mt-3">Last decision: {new Date(data.lastActivityAt).toLocaleString()}</p>
        )}
      </div>
    </div>
  );
};

export default OfficerPerformancePage;
