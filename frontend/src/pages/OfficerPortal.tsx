import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Square, LogOut, LayoutDashboard, Clock, CheckCircle2, ShieldAlert, FileCheck2, ClipboardList, Eye } from 'lucide-react';
import apiService from '../services/apiService';
import { Workflow } from '../types/workflow';
import { OfficerRole, ROLE_DEPARTMENT, ROLE_LABELS } from '../features/officer/officerAuth';
import { useAuthUser, useLogout } from '../features/auth/auth';
import WorkflowReviewPanel from '../features/officer/WorkflowReviewPanel';
import GovernanceAlertsPanel from '../features/officer/GovernanceAlertsPanel';
import ChangeDetectionPanel from '../features/change-detection/ChangeDetectionPanel';

function isToday(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

// Route-level RequireAuth (see App.tsx) already guarantees a signed-in
// officer before this ever mounts; `data` still starts undefined for one
// render while the shared /auth/me query resolves from cache.
const OfficerPortal: React.FC = () => {
  const { data: user } = useAuthUser();
  const logout = useLogout();

  if (!user) return null;

  const role = user.role as OfficerRole;
  return (
    <OfficerDashboard department={ROLE_DEPARTMENT[role]} name={user.name} roleLabel={ROLE_LABELS[role]} onLogout={logout} />
  );
};

interface OfficerDashboardProps {
  department: string;
  name: string;
  roleLabel: string;
  onLogout: () => void;
}

// Section-heading style shared across this dashboard's bordered cards -
// square/secondary is this portal's role-shape accent (docs/design.md §2),
// used here purely for the icon chip, never for status-bearing elements.
const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

const OfficerDashboard: React.FC<OfficerDashboardProps> = ({ department, name, roleLabel, onLogout }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['officer-workflows', department],
    async () => {
      const response = await apiService.get('/workflows', { params: { department } });
      return response.data;
    },
  );

  const myStepOf = (workflow: Workflow) => workflow.steps.find((s) => s.department === department);

  const pendingWorkflows = workflows.filter((w) => myStepOf(w)?.status === 'PENDING');
  const decidedSteps = workflows.map(myStepOf).filter((s) => s && (s.status === 'APPROVED' || s.status === 'REJECTED'));
  const verifiedToday = decidedSteps.filter((s) => isToday(s!.completedAt)).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-4 border-ink pb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center bg-secondary/15 border-2 border-ink text-secondary">
            <Square className="w-6 h-6 fill-current" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">Officer Portal</h1>
            <p className="text-ink/70 mt-1 font-medium">Welcome, {name} ({roleLabel})</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-widest shadow-hard-sm transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Logout
        </button>
      </div>

      <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <h2 className={sectionHeadingClass}>
          <LayoutDashboard className="w-5 h-5 text-secondary" aria-hidden="true" />
          Dashboard Overview
        </h2>
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
            <p className="text-3xl font-black font-display text-ink"><GovernanceAlertsCount /></p>
          </div>
          <div className="bg-surface border-2 border-ink shadow-hard-sm p-4">
            <div className="w-9 h-9 mb-3 flex items-center justify-center border-2 border-ink bg-secondary/20 text-secondary">
              <FileCheck2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">Documents Processed</h3>
            <p className="text-3xl font-black font-display text-ink">{decidedSteps.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
          <h2 className={sectionHeadingClass}>
            <ClipboardList className="w-5 h-5 text-secondary" aria-hidden="true" />
            Assigned Workflows
          </h2>
          {isLoading ? (
            <div className="text-ink/60 text-sm">Loading workflows...</div>
          ) : error ? (
            <div className="text-ink/60 text-sm">Error loading workflows</div>
          ) : pendingWorkflows.length === 0 ? (
            <div className="text-ink/60 text-sm">No workflows currently pending your review.</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {pendingWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  className={`border-2 px-3.5 py-3 cursor-pointer transition ${
                    selectedWorkflowId === workflow.id ? 'border-primary bg-primary/10 shadow-hard-sm' : 'border-ink hover:bg-muted'
                  }`}
                >
                  <p className="font-bold text-sm uppercase tracking-wide text-ink">{workflow.workflowType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ink/60 mt-0.5">Parcel: {workflow.parcelId}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
          <h2 className={sectionHeadingClass}>
            <Eye className="w-5 h-5 text-secondary" aria-hidden="true" />
            Workflow Review
          </h2>
          {selectedWorkflowId ? (
            <WorkflowReviewPanel workflowId={selectedWorkflowId} officerDepartment={department} />
          ) : (
            <p className="text-sm text-ink/60">Select a workflow from the list to review it.</p>
          )}
        </div>
      </div>

      <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
        <h2 className={sectionHeadingClass}>
          <ShieldAlert className="w-5 h-5 text-secondary" aria-hidden="true" />
          Governance Alerts
        </h2>
        <GovernanceAlertsPanel />
      </div>

      <ChangeDetectionPanel />
    </div>
  );
};

// Small standalone piece so the stat card can share the exact same cached
// query (and count) that GovernanceAlertsPanel below already fetches,
// without this component needing to know the panel's internals.
const GovernanceAlertsCount: React.FC = () => {
  const { data: alerts = [] } = useQuery<unknown[]>(['governance-alerts', 'OPEN'], async () => {
    const response = await apiService.get('/governance-alerts', { params: { status: 'OPEN' } });
    return response.data;
  });
  return <>{alerts.length}</>;
};

export default OfficerPortal;
