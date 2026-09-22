import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, MapPinned, Package, ChevronDown, ChevronRight, FileText, MapPin, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiService from '../../services/apiService';
import { DepartmentTaskOut, CaseDetailOut } from '../../types/aiFlow';
import { ParcelSummary } from '../../types/parcel';
import UnifiedMapWrapper from '../../features/map/UnifiedMapWrapper';

/**
 * Offline case package returned by GET /cases/{case_id}/verifier-package (§30).
 * Contains everything a verifier needs for a field visit.
 */
interface VerifierPackage {
  case: CaseDetailOut['case'];
  parcel?: {
    ulpin?: string | null;
    survey_no?: string | null;
    area_sq_m?: number | null;
    state_code?: string;
    district_code?: string;
    street_address?: string | null;
    locality?: string | null;
  } | null;
  application?: {
    final_submitted_version?: string | null;
    ai_draft?: string | null;
  } | null;
  task_instructions?: string | null;
  existing_evidence_count?: number;
}

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
  const [packageData, setPackageData] = useState<VerifierPackage | null>(null);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [showPackage, setShowPackage] = useState(false);

  const departmentLabel = task.department_id || t('verifierPortal.unknownDepartment');

  const fetchCasePackage = async () => {
    if (packageData) {
      setShowPackage((prev) => !prev);
      return;
    }
    setPackageLoading(true);
    setPackageError(null);
    try {
      const response = await apiService.get<VerifierPackage>(`/cases/${task.case_id}/verifier-package`);
      setPackageData(response.data);
      setShowPackage(true);
    } catch (err: any) {
      setPackageError(
        err?.response?.data?.detail ?? t('verifierPortal.packageLoadError', 'Failed to load case package.'),
      );
    } finally {
      setPackageLoading(false);
    }
  };

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

          {/* Action links */}
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/verifier/task/${task.id}/evidence`}
              id={`capture-evidence-${task.id}`}
              className="inline-block text-primary hover:text-primary-strong font-bold text-xs uppercase tracking-wide underline underline-offset-2"
            >
              {t('verifierPortal.captureEvidenceCta')}
            </Link>
            <Link
              to={`/verifier/task/${task.id}/findings`}
              id={`submit-findings-${task.id}`}
              className="inline-block text-primary hover:text-primary-strong font-bold text-xs uppercase tracking-wide underline underline-offset-2"
            >
              {t('verifierPortal.submitFindingsCta')}
            </Link>

            {/* Case Package download/view button (§30) */}
            <button
              id={`get-case-package-${task.id}`}
              type="button"
              onClick={fetchCasePackage}
              disabled={packageLoading}
              className="inline-flex items-center gap-1.5 text-primary hover:text-primary-strong font-bold text-xs uppercase tracking-wide underline underline-offset-2 disabled:opacity-50"
            >
              <Package className="w-3.5 h-3.5" aria-hidden="true" />
              {packageLoading
                ? t('verifierPortal.packageLoading', 'Loading...')
                : showPackage && packageData
                ? t('verifierPortal.hidePackage', 'Hide Case Package')
                : t('verifierPortal.getCasePackage', 'Get Case Package')}
            </button>
          </div>

          {/* Package error */}
          {packageError && (
            <p className="flex items-center gap-1.5 text-xs text-secondary-strong">
              <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {packageError}
            </p>
          )}

          {/* Case package panel (§30 — offline case package) */}
          {showPackage && packageData && (
            <div className="border-2 border-ink/30 bg-surface-2 p-3 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-ink flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                {t('verifierPortal.packageTitle', 'Case Package')}
                <span className="font-mono text-ink/40 ml-auto">
                  {packageData.case?.case_no ?? '—'}
                </span>
              </h4>

              {/* Parcel info */}
              {packageData.parcel && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">
                    {t('verifierPortal.parcelInfo', 'Parcel')}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {packageData.parcel.ulpin && (
                      <>
                        <span className="text-ink/50">ULPIN</span>
                        <span className="font-mono font-semibold">{packageData.parcel.ulpin}</span>
                      </>
                    )}
                    {packageData.parcel.area_sq_m != null && (
                      <>
                        <span className="text-ink/50">{t('verifierPortal.area', 'Area')}</span>
                        <span className="font-semibold">{packageData.parcel.area_sq_m.toLocaleString()} m²</span>
                      </>
                    )}
                    {packageData.parcel.street_address && (
                      <>
                        <span className="text-ink/50">{t('verifierPortal.address', 'Address')}</span>
                        <span className="font-semibold">{packageData.parcel.street_address}</span>
                      </>
                    )}
                    {packageData.parcel.district_code && (
                      <>
                        <span className="text-ink/50">{t('verifierPortal.district', 'District')}</span>
                        <span className="font-semibold">
                          {packageData.parcel.state_code}-{packageData.parcel.district_code}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Task instructions */}
              {packageData.task_instructions && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">
                    {t('verifierPortal.taskInstructions', 'Task Instructions')}
                  </p>
                  <p className="text-xs text-ink/80 leading-relaxed">{packageData.task_instructions}</p>
                </div>
              )}

              {/* Application summary */}
              {packageData.application?.final_submitted_version && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/40">
                    {t('verifierPortal.applicationSummary', 'Citizen Application')}
                  </p>
                  <p className="text-xs text-ink/80 leading-relaxed line-clamp-6">
                    {packageData.application.final_submitted_version}
                  </p>
                </div>
              )}

              {/* Existing evidence count */}
              {packageData.existing_evidence_count != null && (
                <p className="text-xs text-ink/60">
                  <span className="font-bold">{packageData.existing_evidence_count}</span>{' '}
                  {t('verifierPortal.existingEvidence', 'existing evidence item(s) on this case')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssignedVisitsPage;