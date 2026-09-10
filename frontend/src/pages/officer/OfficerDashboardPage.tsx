import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

  const { data: alerts = [] } = useQuery<any[]>(['governance-alerts', 'OPEN'], async () => {
    const response = await apiService.get('/governance-alerts', { params: { status: 'OPEN' } });
    return response.data;
  });

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
          background: 'linear-gradient(135deg, var(--brand-900) 0%, #154D3B 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 30px rgba(15, 61, 46, 0.12)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold"
                style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#FBBF24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                OFFICIAL DESK · {ROLE_LABELS[user?.role as OfficerRole] ?? 'REVENUE OFFICER'}
              </span>
              <span className="text-white/40 text-xs hidden sm:inline">|</span>
              <span className="text-white/80 text-xs font-mono">
                Department: {department.replace(/_/g, ' ')}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-heading font-bold text-white tracking-tight">
              Officer Console: {user?.name || 'Officer'}
            </h1>
            <p className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed">
              Jurisdictional adjudication dashboard. Review citizen mutation requests, conduct survey cross-verification, and act on cross-department alerts.
            </p>
          </div>
        </div>
      </div>

      {/* ── Key Operational Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Pending Adjudication
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-action-500/15 text-action-700">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-action-700">
              {isLoading ? '...' : pendingWorkflows.length}
            </span>
            <span className="text-xs font-mono text-action-700 font-semibold">Cases awaiting action</span>
          </div>
          <Link
            to="/officer/requests"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-action-700 hover:text-action-600 transition"
          >
            Review Queue <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Total Decided
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-900/10 text-brand-900">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {isLoading ? '...' : decidedSteps.length}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">Signed orders</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
            Cumulative total
          </span>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Processed Today
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100 text-gov-success">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {isLoading ? '...' : verifiedToday}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">Today's throughput</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
            Within statutory SLA
          </span>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Open Governance Alerts
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-100 text-gov-error">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-gov-error">
              {alerts.length}
            </span>
            <span className="text-xs font-mono text-gov-error font-semibold">Encroachment / Overlaps</span>
          </div>
          <Link
            to="/officer/alerts"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gov-error hover:underline transition"
          >
            Investigate Alerts <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Action Queue Table ── */}
      <div className="gov-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-heading font-bold text-lg text-text-heading">
              Department Pending Cases Queue
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Applications requiring your department's verification or approval stamp
            </p>
          </div>
          <Link
            to="/officer/requests"
            className="text-xs font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
          >
            Open Full Desk <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-text-muted">Loading pending queue…</div>
        ) : pendingWorkflows.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
            <CheckCircle2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
            <p className="text-sm font-semibold text-text-heading">All cases are adjudicated</p>
            <p className="text-xs text-text-secondary mt-1">
              Your desk currently has zero backlogged workflows.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                  <th className="pb-3 font-semibold">Application No</th>
                  <th className="pb-3 font-semibold">Parcel ID</th>
                  <th className="pb-3 font-semibold">Request Type</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Submitted Date</th>
                  <th className="pb-3 font-semibold text-right">Adjudicate</th>
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
                        PENDING YOUR REVIEW
                      </span>
                    </td>
                    <td className="py-3 text-text-secondary font-mono">
                      {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'Recent'}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/officer/requests?workflow=${w.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition"
                      >
                        Action <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficerDashboardPage;
