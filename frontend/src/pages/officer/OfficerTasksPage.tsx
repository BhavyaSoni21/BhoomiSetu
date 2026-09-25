import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../context/LanguageContext';
import apiService from '../../services/apiService';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import OfficerTaskDetailModal from '../../components/officer/OfficerTaskDetailModal';

// The /cases/tasks/my response is camelCase (CamelModel, default by_alias=True).
// The shared snake_case DepartmentTaskOut type does NOT match this wire, so this
// page reads the real keys directly. Only the fields this tab renders.
type MyTask = {
  id: string;
  caseId: string;
  caseNo?: string | null;
  status: string;
  stage: number;
  stageName?: string | null;
  createdAt: string;
};

const taskStatusLabels: Record<string, string> = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const taskStatusIcons: Record<string, React.ReactNode> = {
  PENDING: <Clock className="w-4 h-4" />,
  ASSIGNED: <ClipboardList className="w-4 h-4" />,
  IN_PROGRESS: <AlertTriangle className="w-4 h-4" />,
  BLOCKED: <AlertTriangle className="w-4 h-4 text-red-500" />,
  COMPLETED: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  CANCELLED: <AlertTriangle className="w-4 h-4 text-gray-500" />,
};

const OfficerTasksPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedTask, setSelectedTask] = useState<{ taskId: string; caseId: string } | null>(null);

  const { data: tasks = [], isLoading, isError } = useQuery<MyTask[]>(
    ['my-tasks'],
    () => apiService.get('/cases/tasks/my').then(res => res.data),
    { staleTime: 2 * 60 * 1000 },
  );

  const pendingCount = tasks.filter((t) => t.status === 'PENDING' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  const handleTaskClick = (task: MyTask) => {
    setSelectedTask({ taskId: task.id, caseId: task.caseId });
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-5xl">
      <div className="pb-4 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            {t('officerTasks.title', 'My Tasks')}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            {t('officerTasks.subtitle', 'Department tasks assigned to you')}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="px-2 py-1 bg-gray-100 rounded-full">
            {pendingCount} {t('officerTasks.pendingLabel', 'Pending')}
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
            {completedCount} {t('officerTasks.completedLabel', 'Completed')}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-text-muted">
          {t('officerTasks.loading', 'Loading your tasks...')}
        </div>
      ) : isError ? (
        <div className="p-4 rounded-xl bg-red-50 text-red-800 text-sm border border-red-200">
          {t('officerTasks.error', 'Unable to load tasks.')}
        </div>
      ) : tasks.length === 0 ? (
        <div className="gov-card p-12 text-center bg-surface-2 border border-gov-border">
          <ClipboardList className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <h3 className="font-heading font-bold text-base text-text-heading">
            {t('officerTasks.noTasksHeading', 'No tasks assigned')}
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            {t('officerTasks.noTasksDesc', 'You have no department tasks at this time.')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('officerTasks.colCase', 'Case')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('officerTasks.colStage', 'Stage')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('officerTasks.colStatus', 'Status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('officerTasks.colCreated', 'Created')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('officerTasks.colActions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tasks.map((task) => {
                const statusKey = task.status as keyof typeof taskStatusLabels;
                return (
                  <tr key={task.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-text-heading">
                      {task.caseNo || `#${String(task.caseId).slice(0, 8)}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {task.stageName || `Stage ${task.stage}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-mono text-[10px] font-semibold ${
                          task.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : task.status === 'BLOCKED'
                            ? 'bg-red-100 text-red-800'
                            : task.status === 'CANCELLED'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {taskStatusIcons[statusKey] ?? <Clock className="w-3 h-3" />}
                        {taskStatusLabels[task.status] ?? task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleTaskClick(task)}
                        className="text-brand-700 hover:text-brand-900 font-semibold underline underline-offset-2"
                      >
                        {t('officerTasks.viewButton', 'Manage')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && (
        <OfficerTaskDetailModal
          taskId={selectedTask.taskId}
          caseId={selectedTask.caseId}
          isOpen={true}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
};

export default OfficerTasksPage;
