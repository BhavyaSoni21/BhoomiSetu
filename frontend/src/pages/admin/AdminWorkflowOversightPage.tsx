import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Workflow as WorkflowIcon, Eye } from 'lucide-react';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';
import WorkflowReviewPanel from '../../features/officer/WorkflowReviewPanel';
import BackButton from '../../components/BackButton';

const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

// Every department code workflow steps can be assigned to (mirrors
// ROLE_DEPARTMENT in features/officer/officerAuth.ts / backend/src/auth/roles.constants.ts).
const DEPARTMENTS = ['LAND_RECORDS', 'REGISTRATION', 'PLANNING', 'DISPUTE', 'TAX', 'RESTRICTION', 'ENCUMBRANCE'];

const STATUS_BADGE_STYLES: Record<string, string> = {
  PENDING: 'border-accent text-secondary-strong',
  SUBMITTED: 'border-accent text-secondary-strong',
  IN_PROGRESS: 'border-accent text-secondary-strong',
  APPROVED: 'border-primary text-primary',
  REJECTED: 'border-secondary text-secondary-strong',
};

// Coming Soon #2 (docs/ADMIN_PANEL_ISSUES.md) - the backend already lets an
// Admin decide any department's workflow step (WorkflowsController.reviewStep
// has no department restriction for ADMIN), but there was no review screen
// for it. GET /workflows with no department param returns every department's
// workflows when the caller is ADMIN (WorkflowsController.findAll) - the
// department/pending filters below are optional narrowing on top of that.
// Reuses WorkflowReviewPanel in its "no officerDepartment" oversight mode,
// which shows a review form for every still-pending step (any department),
// not just one.
const AdminWorkflowOversightPage: React.FC = () => {
  const { t } = useTranslation();
  const [department, setDepartment] = useState('');
  // Defaults to showing every status, not just PENDING - per the user's
  // explicit "the admin should be able to see whether the request is
  // accepted rejected or still pending", the accepted/rejected ones
  // shouldn't be hidden behind an extra toggle before that's visible.
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const { data: workflows = [], isLoading, error } = useQuery<Workflow[]>(
    ['admin-workflows', department, pendingOnly],
    async () =>
      (
        await apiService.get('/workflows', {
          params: {
            department: department || undefined,
            stepStatus: pendingOnly ? 'PENDING' : undefined,
          },
        })
      ).data,
  );

  const pendingCount = workflows.filter((w) => w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS').length;
  const approvedCount = workflows.filter((w) => w.currentStatus === 'APPROVED').length;
  const rejectedCount = workflows.filter((w) => w.currentStatus === 'REJECTED').length;

  return (
    <div className="space-y-6">
      <BackButton variant="ink" />
      <div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">{t('adminNav.workflows')}</h1>
        <p className="text-ink/60 mt-1">
          {t('adminPortal.workflowOversightSubtitle')}
        </p>
      </div>

      {/* At-a-glance status breakdown (per the user's explicit "the admin
          should be able to see whether the request is accepted rejected or
          still pending") - counts reflect whatever the filters below are
          currently narrowed to. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border-2 border-ink bg-accent/15 px-4 py-3">
          <p className="text-2xl font-black text-ink">{pendingCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60">{t('adminPortal.statusPendingLabel')}</p>
        </div>
        <div className="border-2 border-ink bg-primary/15 px-4 py-3">
          <p className="text-2xl font-black text-primary">{approvedCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60">{t('adminPortal.statusApprovedLabel')}</p>
        </div>
        <div className="border-2 border-ink bg-secondary/15 px-4 py-3">
          <p className="text-2xl font-black text-secondary-strong">{rejectedCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60">{t('adminPortal.statusRejectedLabel')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="department-filter" className="text-xs font-bold uppercase tracking-widest text-ink/60">
          {t('adminPortal.departmentLabel')}
        </label>
        <select
          id="department-filter"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="border-2 border-ink bg-surface text-ink px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-primary"
        >
          <option value="">{t('adminPortal.allDepartments')}</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink/60 cursor-pointer">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
            className="w-4 h-4 border-2 border-ink accent-primary"
          />
          {t('adminPortal.pendingOnlyLabel')}
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
          <h2 className={sectionHeadingClass}>
            <WorkflowIcon className="w-5 h-5 text-primary" aria-hidden="true" />
            {t('adminNav.workflows')}
          </h2>
          {isLoading ? (
            <div className="text-ink/60 text-sm">{t('adminPortal.loadingWorkflows')}</div>
          ) : error ? (
            <div className="text-ink/60 text-sm">{t('adminPortal.errorLoadingWorkflows')}</div>
          ) : workflows.length === 0 ? (
            <div className="text-ink/60 text-sm">{t('adminPortal.noWorkflowsMatchFilters')}</div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {workflows.map((workflow) => {
                const pendingDepartments = workflow.steps.filter((s) => s.status === 'PENDING').map((s) => s.department);
                return (
                  <div
                    key={workflow.id}
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    className={`border-2 px-3.5 py-3 cursor-pointer transition ${
                      selectedWorkflowId === workflow.id ? 'border-primary bg-primary/10 shadow-hard-sm' : 'border-ink hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-sm uppercase tracking-wide text-ink">{workflow.workflowType.replace(/_/g, ' ')}</p>
                      <span
                        className={`shrink-0 border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          STATUS_BADGE_STYLES[workflow.currentStatus] ?? 'border-ink/20 text-ink/60'
                        }`}
                      >
                        {workflow.currentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-ink/60 mt-0.5">{t('adminPortal.parcelLabel', { id: workflow.parcelId })}</p>
                    {pendingDepartments.length > 0 && (
                      <p className="text-xs text-secondary-strong mt-1">
                        {t('adminPortal.pendingDepartmentsLabel', { departments: pendingDepartments.map((d) => d.replace(/_/g, ' ')).join(', ') })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
          <h2 className={sectionHeadingClass}>
            <Eye className="w-5 h-5 text-primary" aria-hidden="true" />
            {t('adminPortal.workflowReviewHeading')}
          </h2>
          {selectedWorkflowId ? (
            <WorkflowReviewPanel workflowId={selectedWorkflowId} />
          ) : (
            <p className="text-sm text-ink/60">{t('adminPortal.selectWorkflowPrompt')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminWorkflowOversightPage;
