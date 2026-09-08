import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2, ShieldAlert, FileCheck2, ClipboardList, Bell } from 'lucide-react';
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

// Work summary only (docs/FRONTEND_UPGRADE_SPEC.md §5) - the pending-workflow
// list and its review panel, previously embedded right here, now live on
// their own Assigned Requests page; this page keeps only the stat cards plus
// quick links into the rest of the portal.
const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

const OfficerDashboardPage: React.FC<OfficerDashboardPageProps> = ({ department }) => {
  const { data: user } = useAuthUser();
  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['officer-workflows', department],
    async () => (await apiService.get('/workflows', { params: { department } })).data,
  );
  const { data: alerts = [] } = useQuery<unknown[]>(['governance-alerts', 'OPEN'], async () => {
    const response = await apiService.get('/governance-alerts', { params: { status: 'OPEN' } });
    return response.data;
  });

  const myStepOf = (workflow: Workflow) => workflow.steps.find((s) => s.department === department);
  const pendingWorkflows = workflows.filter((w) => myStepOf(w)?.status === 'PENDING');
  const decidedSteps = workflows.map(myStepOf).filter((s) => s && (s.status === 'APPROVED' || s.status === 'REJECTED'));
  const verifiedToday = decidedSteps.filter((s) => isToday(s!.completedAt)).length;

  const quickLinks = [
    { to: '/officer/requests', Icon: ClipboardList, label: 'Assigned Requests' },
    { to: '/officer/alerts', Icon: ShieldAlert, label: 'Governance Alerts' },
    { to: '/officer/map', Icon: FileCheck2, label: 'Map' },
    { to: '/officer/notifications', Icon: Bell, label: 'Notifications' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">
          Welcome, {user?.name} {user && `(${ROLE_LABELS[user.role as OfficerRole]})`}
        </h1>
        <p className="text-ink/60 mt-1">A summary of your assigned work.</p>
      </div>

      <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <h2 className={sectionHeadingClass}>Dashboard Overview</h2>
        {isLoading ? (
          <div className="text-ink/60 text-sm">Loading workflows...</div>
        ) : error ? (
          <div className="text-ink/60 text-sm">Error loading workflows</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface border-2 border-ink shadow-hard-sm p-4">
              <div className="w-9 h-9 mb-3 flex items-center justify-center border-2 border-ink bg-accent/20 text-accent">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">Pending Workflows</h3>
              <p className="text-3xl font-black font-display text-ink">{pendingWorkflows.length}</p>
            </div>
            <div className="bg-surface border-2 border-ink shadow-hard-sm p-4">
              <div className="w-9 h-9 mb-3 flex items-center justify-center border-2 border-ink bg-primary/20 text-primary">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">Verified Today</h3>
              <p className="text-3xl font-black font-display text-ink">{verifiedToday}</p>
            </div>
            <div className="bg-surface border-2 border-ink shadow-hard-sm p-4">
              <div className="w-9 h-9 mb-3 flex items-center justify-center border-2 border-ink bg-accent/20 text-accent">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">Alerts Requiring Attention</h3>
              <p className="text-3xl font-black font-display text-ink">{alerts.length}</p>
            </div>
            <div className="bg-surface border-2 border-ink shadow-hard-sm p-4">
              <div className="w-9 h-9 mb-3 flex items-center justify-center border-2 border-ink bg-secondary/20 text-secondary">
                <FileCheck2 className="w-4 h-4" aria-hidden="true" />
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">Documents Processed</h3>
              <p className="text-3xl font-black font-display text-ink">{decidedSteps.length}</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-ink/60 mb-3">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map(({ to, Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 bg-surface border-2 border-ink px-4 py-3.5 font-bold text-sm text-ink shadow-hard-sm transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              <Icon className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OfficerDashboardPage;
