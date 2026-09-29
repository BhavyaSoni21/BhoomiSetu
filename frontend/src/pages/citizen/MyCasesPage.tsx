import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiService from '../../services/apiService';
import { useTranslation } from '../../context/LanguageContext';
import { CaseOut, CaseDetailOut } from '../../types/aiFlow';
import { Eye, ChevronDown, ChevronRight, CheckCircle2, Clock, AlertTriangle, Ban } from 'lucide-react';

// Case.status (case_service.CASE_STATUSES).
const statusColor: Record<string, string> = {
  CREATED: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  RESOLUTION: 'bg-green-100 text-green-800',
  FEEDBACK: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

// DepartmentTask.status → plain-language label key + icon. Citizens see what a
// department is doing, not the raw enum.
const TASK_STATUS: Record<string, { key: string; fallback: string; icon: React.ElementType; className: string }> = {
  PENDING: { key: 'cases.taskStatus.PENDING', fallback: 'Waiting to start', icon: Clock, className: 'text-yellow-600' },
  ASSIGNED: { key: 'cases.taskStatus.ASSIGNED', fallback: 'Assigned to an officer', icon: Clock, className: 'text-blue-600' },
  IN_PROGRESS: { key: 'cases.taskStatus.IN_PROGRESS', fallback: 'Being reviewed', icon: Clock, className: 'text-blue-600' },
  BLOCKED: { key: 'cases.taskStatus.BLOCKED', fallback: 'On hold — action needed', icon: AlertTriangle, className: 'text-red-600' },
  COMPLETED: { key: 'cases.taskStatus.COMPLETED', fallback: 'Completed', icon: CheckCircle2, className: 'text-green-600' },
  CANCELLED: { key: 'cases.taskStatus.CANCELLED', fallback: 'Cancelled', icon: Ban, className: 'text-gray-500' },
};

// resolution_decision → plain-language outcome key.
const DECISION: Record<string, { key: string; fallback: string }> = {
  APPROVE: { key: 'cases.decision.APPROVE', fallback: 'Approved' },
  REJECT: { key: 'cases.decision.REJECT', fallback: 'Rejected' },
  RETURN_FOR_REVIEW: { key: 'cases.decision.RETURN_FOR_REVIEW', fallback: 'Returned for more information' },
};

const CaseDetailRow: React.FC<{ caseId: string }> = ({ caseId }) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery<CaseDetailOut>({
    queryKey: ['case-detail', caseId],
    queryFn: () => apiService.get(`/cases/${caseId}/detail`).then((r) => r.data),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <div className="px-6 py-3 text-sm text-gray-500">{t('cases.loadingDetail', 'Loading department progress...')}</div>;
  if (isError || !data) return <div className="px-6 py-3 text-sm text-red-600">{t('cases.detailError', 'Unable to load department progress.')}</div>;

  const tasks = data.tasks ?? [];
  if (tasks.length === 0) return <div className="px-6 py-3 text-sm text-gray-500">{t('cases.noDepartments', 'No departments assigned yet.')}</div>;

  return (
    <div className="px-6 py-4 bg-gray-50 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('cases.departmentProgress', 'Department progress')}</p>
      {tasks.map((task) => {
        const st = TASK_STATUS[task.status] ?? { key: '', fallback: task.status, icon: Clock, className: 'text-gray-500' };
        const Icon = st.icon;
        const decision = task.resolutionDecision ? DECISION[task.resolutionDecision] : null;
        return (
          <div key={task.id} className="flex items-start gap-3 border-l-2 border-gray-300 pl-3">
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${st.className}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {task.departmentName || task.departmentCode || t('cases.department', 'Department')}
              </p>
              <p className={`text-xs ${st.className}`}>{t(st.key, st.fallback)}</p>
              {decision && (
                <p className="text-xs text-gray-700 mt-0.5">
                  <span className="font-semibold">{t('cases.outcome', 'Outcome')}:</span> {t(decision.key, decision.fallback)}
                </p>
              )}
              {task.resolutionRemarks && (
                <p className="text-xs text-gray-600 mt-0.5">
                  <span className="font-semibold">{t('cases.reason', 'Reason')}:</span> {task.resolutionRemarks}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MyCasesPage: React.FC = () => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: cases, isLoading, isError } = useQuery({
    queryKey: ['cases-mine'],
    queryFn: () => apiService.get<CaseOut[]>('/cases/my').then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (isLoading) return <div className="py-6">{t('cases.loading', 'Loading your cases...')}</div>;
  if (isError) return <div className="py-6 text-red-600">{t('cases.error', 'Unable to load cases.')}</div>;

  const caseList = cases ?? [];

  if (caseList.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{t('cases.noCases', 'You have no cases yet.')}</p>
        <Link to="/citizen/get-assistance" className="btn-primary">
          {t('cases.startCase', 'Start a new case')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-4">{t('cases.title', 'My Cases')}</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('cases.caseNumber', 'Case #')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('cases.intent', 'Intent')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('cases.status', 'Status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('cases.created', 'Created')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('cases.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {caseList.map((c) => {
              const isOpen = expanded.has(c.id);
              return (
                <React.Fragment key={c.id}>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        aria-expanded={isOpen}
                        aria-label={t('cases.toggleDetail', 'Show department progress')}
                        className="text-gray-500 hover:text-gray-900"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.caseNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{(c.intent ?? '').replace(/_/g, ' ') || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[c.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {t(`cases.status.${c.status}`, c.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link to={`/parcels/${c.parcelId}`} className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{t('cases.view', 'View')}</span>
                      </Link>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <CaseDetailRow caseId={c.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyCasesPage;
