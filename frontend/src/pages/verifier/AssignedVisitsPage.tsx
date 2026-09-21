import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiService from '../../services/apiService';
import { DepartmentTaskOut, CaseDetailOut } from '../../types/aiFlow';
import { ParcelSummary } from '../../types/parcel';
import UnifiedMapWrapper from '../../features/map/UnifiedMapWrapper';

const AssignedVisitsPage: React.FC = () => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery<DepartmentTaskOut[]>(
    ['verifier-assigned-tasks'],
    async () => (await apiService.get('/cases/verifier/tasks')).data,
  );

  const { data: caseDetails = {} } = useQuery<Record<string, CaseDetailOut>>(
    ['verifier-case-details', tasks.map((t) => t.id)],
    async () => {
      const result: Record<string, CaseDetailOut> = {};
      await Promise.all(
        tasks.map(async (task) => {
          try {
            const response = await apiService.get(`/cases/${task.case_id}`);
            result[task.id] = response.data;
          } catch {
            // Skip tasks where case fetch fails
          }
        }),
      );
      return result;
    },
    {
      enabled: tasks.length > 0,
      staleTime: 1000 * 60 * 2,
    },
  );

  const parcelIds = useMemo(
    () =>
      tasks
        .map((task) => caseDetails[task.id]?.case?.parcel_id)
        .filter((id): id is string => !!id),
    [tasks, caseDetails],
  );

  const { data: parcelSummaries = [] } = useQuery<ParcelSummary[]>(
    ['verifier-parcels', parcelIds],
    async () => {
      const results = await Promise.all(
        parcelIds.map(async (id) => {
          try {
            const response = await apiService.get(`/parcels/${id}/summary`);
            return response.data;
          } catch {
            return null;
          }
        }),
      );
      return results.filter((p): p is ParcelSummary => p !== null);
    },
    {
      enabled: parcelIds.length > 0,
      staleTime: 1000 * 60 * 2,
    },
  );

  const handleParcelClick = (parcelId: string) => {
    setSelectedParcelId(parcelId);
    const task = tasks.find((t) => caseDetails[t.id]?.case?.parcel_id === parcelId);
    if (task) {
      setExpandedId(task.id);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink flex items-center gap-2">
          <ClipboardList className="w-5 h-5" aria-hidden="true" />
          {t('verifierPortal.assignedVisitsTitle')}
        </h1>
        <p className="text-sm text-ink/60 mt-1">{t('verifierPortal.assignedVisitsSubtitle')}</p>
      </div>

      {isLoading && <p className="text-sm text-ink/60">{t('verifierPortal.loadingVisits')}</p>}
      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-ink/60 border-2 border-ink/20 p-4">{t('verifierPortal.noAssignedVisits')}</p>
      )}

      {!isLoading && tasks.length > 0 && parcelSummaries.length > 0 && (
        <div className="border-2 border-ink h-[400px]">
          <UnifiedMapWrapper
            parcels={parcelSummaries}
            selectedParcelId={selectedParcelId}
            onParcelClick={handleParcelClick}
            fitToParcels={true}
            showLayerPanel={false}
            userRole="VERIFIER"
            height="h-[400px]"
          />
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <VisitCard
            key={task.id}
            task={task}
            expanded={expandedId === task.id}
            onToggle={() => setExpandedId((prev) => (prev === task.id ? null : task.id))}
          />
        ))}
      </div>
    </div>
  );
};

const VisitCard: React.FC<{
  task: DepartmentTaskOut;
  expanded: boolean;
  onToggle: () => void;
}> = ({ task, expanded, onToggle }) => {
  const { t } = useTranslation();
  const departmentLabel = task.department_id || t('verifierPortal.unknownDepartment');

  return (
    <div className="border-2 border-ink bg-surface-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 transition"
      >
        <div>
          <p className="font-bold text-sm text-ink">{departmentLabel.replace(/_/g, ' ')}</p>
          <p className="text-xs text-ink/60 flex items-center gap-1">
            <MapPinned className="w-3.5 h-3.5" aria-hidden="true" />
            Case #{task.case_id.slice(0, 8)} — {task.status.replace(/_/g, ' ')}
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink/50">
          {expanded ? t('verifierPortal.collapseCta') : t('verifierPortal.expandCta')}
        </span>
      </button>

      {expanded && (
        <div className="border-t-2 border-ink p-4 space-y-4">
          <div className="text-sm text-ink/70">
            <span className="font-semibold">{t('verifierPortal.resolutionMode')}:</span>{' '}
            {task.resolution_mode || t('verifierPortal.notApplicable')}
          </div>
          <div className="flex gap-3">
            <Link
              to={`/verifier/task/${task.id}/evidence`}
              className="inline-block text-primary hover:text-primary-strong font-bold text-xs uppercase tracking-wide underline underline-offset-2"
            >
              {t('verifierPortal.captureEvidenceCta')}
            </Link>
            <Link
              to={`/verifier/task/${task.id}/findings`}
              className="inline-block text-primary hover:text-primary-strong font-bold text-xs uppercase tracking-wide underline underline-offset-2"
            >
              {t('verifierPortal.submitFindingsCta')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedVisitsPage;