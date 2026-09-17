import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, MapPinned } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiService from '../../services/apiService';
import { Workflow, FieldEvidence } from '../../types/workflow';
import FieldEvidenceCaptureForm from '../../features/verifier/FieldEvidenceCaptureForm';

const AssignedVisitsPage: React.FC = () => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: workflows = [], isLoading } = useQuery<Workflow[]>(
    ['verifier-assigned-workflows'],
    async () => (await apiService.get('/workflows/assigned-to-me')).data,
  );

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
      {!isLoading && workflows.length === 0 && (
        <p className="text-sm text-ink/60 border-2 border-ink/20 p-4">{t('verifierPortal.noAssignedVisits')}</p>
      )}

      <div className="space-y-3">
        {workflows.map((workflow) => (
          <VisitCard
            key={workflow.id}
            workflow={workflow}
            expanded={expandedId === workflow.id}
            onToggle={() => setExpandedId((prev) => (prev === workflow.id ? null : workflow.id))}
          />
        ))}
      </div>
    </div>
  );
};

const VisitCard: React.FC<{ workflow: Workflow; expanded: boolean; onToggle: () => void }> = ({ workflow, expanded, onToggle }) => {
  const { t } = useTranslation();
  const { data: evidence = [] } = useQuery<FieldEvidence[]>(
    ['field-evidence', workflow.id],
    async () => (await apiService.get(`/workflows/${workflow.id}/field-evidence`)).data,
    { enabled: expanded },
  );

  return (
    <div className="border-2 border-ink bg-surface-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 transition"
      >
        <div>
          <p className="font-bold text-sm text-ink">{workflow.workflowType.replace(/_/g, ' ')}</p>
          <p className="text-xs text-ink/60 flex items-center gap-1">
            <MapPinned className="w-3.5 h-3.5" aria-hidden="true" />
            {workflow.parcelId}
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink/50">
          {expanded ? t('verifierPortal.collapseCta') : t('verifierPortal.expandCta')}
        </span>
      </button>

      {expanded && (
        <div className="border-t-2 border-ink p-4 space-y-4">
          {workflow.requestDetails && <p className="text-sm text-ink/70 italic">&quot;{workflow.requestDetails}&quot;</p>}
          <Link
            to={`/parcels/${workflow.parcelId}`}
            className="inline-block text-primary hover:text-primary-strong font-bold text-xs uppercase tracking-wide underline underline-offset-2"
          >
            {t('officerPortal.viewParcelCta')}
          </Link>

          {evidence.length > 0 && (
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1.5">{t('verifierPortal.previouslySubmittedLabel')}</h4>
              <p className="text-xs text-ink/60">{t('verifierPortal.evidenceCount', { count: evidence.length })}</p>
            </div>
          )}

          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-ink/70 mb-1.5">{t('verifierPortal.captureNewEvidenceLabel')}</h4>
            <FieldEvidenceCaptureForm workflowId={workflow.id} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedVisitsPage;
