import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import apiService from '../../services/apiService';
import QueryError from '../../components/QueryError';

// Officer SLA monitor ("SLA" tab, plan §56). Lists the officer's assigned
// tasks with their SLA status (OK/WARNING/BREACH) from GET /cases/tasks/my/sla.
// Graphical breakdown pie per Request B. `sla` is null when a task has no
// configured SLA - shown as "No SLA".
interface TaskSla {
  taskId: string;
  caseId: string;
  status: string;
  sla: { status: 'OK' | 'WARNING' | 'BREACH'; elapsed_hours: number; thresholds: { warning: number | null; breach: number | null } } | null;
}

const STATUS_STYLE: Record<string, string> = {
  OK: 'bg-emerald-100 text-emerald-900',
  WARNING: 'bg-amber-100 text-amber-900',
  BREACH: 'bg-red-100 text-red-900',
  'No SLA': 'bg-gray-100 text-gray-700',
};
const PIE_COLORS: Record<string, string> = { OK: '#10b981', WARNING: '#f59e0b', BREACH: '#ef4444', 'No SLA': '#9ca3af' };

const OfficerSlaPage: React.FC = () => {
  const { data: rows = [], isLoading, isError, refetch } = useQuery<TaskSla[]>(
    ['my-tasks-sla'],
    async () => (await apiService.get('/cases/tasks/my/sla')).data,
  );

  const label = (r: TaskSla) => r.sla?.status ?? 'No SLA';
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = label(r);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 animate-fade-up max-w-5xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-heading">SLA Monitor</h1>
        <p className="text-sm text-text-secondary mt-1">Service-level status for the tasks assigned to you.</p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-text-muted">Loading SLA status…</div>
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
          <p className="text-sm font-semibold text-text-heading">No tasks assigned to you</p>
          <p className="text-xs text-text-secondary mt-1">SLA timers appear once cases are routed to you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="gov-card p-6">
            <h3 className="font-heading font-bold text-lg text-text-heading mb-4">SLA Breakdown</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((d) => <Cell key={d.name} fill={PIE_COLORS[d.name] ?? '#9ca3af'} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="gov-card p-6 lg:col-span-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                  <th className="pb-3 font-semibold">Case</th>
                  <th className="pb-3 font-semibold">Task Status</th>
                  <th className="pb-3 font-semibold">Elapsed (hrs)</th>
                  <th className="pb-3 font-semibold">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gov-border">
                {rows.map((r) => (
                  <tr key={r.taskId} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 font-mono">
                      <Link to={`/officer/requests?case=${r.caseId}`} className="text-brand-700 hover:text-brand-900">
                        #{r.caseId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-3 text-text-primary">{r.status.replace(/_/g, ' ')}</td>
                    <td className="py-3 font-mono text-text-secondary">{r.sla ? r.sla.elapsed_hours : '-'}</td>
                    <td className="py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${STATUS_STYLE[label(r)]}`}>
                        {label(r)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerSlaPage;
