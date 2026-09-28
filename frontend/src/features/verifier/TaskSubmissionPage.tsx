import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, CheckCircle2, AlertCircle, Send, CheckSquare } from 'lucide-react';
import apiService from '../../services/apiService';
import { saveLocalEvidence, getLocalQueue } from '../../services/verifierLocalSyncService';

type LocationState = { status: 'idle' | 'locating' | 'ready' | 'error'; lat?: number; lng?: number; accuracy?: number; error?: string };

const FINDING_OPTIONS = [
  { value: 'SUPPORTED', labelKey: 'findings.supported' },
  { value: 'NOT_VERIFIED', labelKey: 'findings.notVerified' },
  { value: 'CONTRADICTED', labelKey: 'findings.contradicted' },
  { value: 'PARTIALLY_VERIFIED', labelKey: 'findings.partiallyVerified' },
  { value: 'UNABLE_TO_DETERMINE', labelKey: 'findings.unableToDetermine' },
];

interface FindingEntry {
  field_name: string;
  finding: string;
  description: string;
}

/**
 * Combined field-visit submission (§32/§33). One page, one submit button:
 * optional photo+GPS evidence is uploaded first (best-effort, queued offline on
 * failure like the old EvidenceCapturePage), then the required structured
 * findings are posted. Replaces the two separate Capture Evidence / Submit
 * Findings routes that confused verifiers.
 */
const TaskSubmissionPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // The URL carries the DepartmentTask id; the case-scoped findings endpoint
  // and the workflow-scoped field-evidence endpoint each need a different id.
  // Both live on the task row, so resolve them from the verifier's task list
  // (same cache key as AssignedVisitsPage — usually already warm).
  const { data: tasks = [] } = useQuery<Array<{ id: string; caseId: string; workflowId?: string | null }>>(
    ['verifier-assigned-tasks'],
    async () => (await apiService.get('/cases/verifier/tasks')).data,
  );
  const task = tasks.find((tk) => tk.id === taskId);
  const caseId = task?.caseId;
  const workflowId = task?.workflowId;

  // Evidence state
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceStatus, setEvidenceStatus] = useState<'idle' | 'uploaded' | 'queued' | 'save_failed'>('idle');

  // Findings state
  const [findings, setFindings] = useState<FindingEntry[]>([{ field_name: '', finding: '', description: '' }]);
  const [overallFinding, setOverallFinding] = useState('');
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getLocalQueue().length > 0) setEvidenceStatus('queued');
  }, []);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocation({ status: 'error', error: t('fieldEvidence.geolocationUnsupported') });
      return;
    }
    setLocation({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ status: 'ready', lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => setLocation({ status: 'error', error: t('fieldEvidence.locationPermissionDenied') }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleFindingChange = (index: number, field: keyof FindingEntry, value: string) => {
    const updated = [...findings];
    updated[index] = { ...updated[index], [field]: value };
    setFindings(updated);
  };
  const addFinding = () => setFindings([...findings, { field_name: '', finding: '', description: '' }]);
  const removeFinding = (index: number) => setFindings(findings.filter((_, i) => i !== index));

  const photoHash = (p: File): string => `${p.name}-${p.size}-${p.lastModified}`;

  const submitMutation = useMutation(
    async () => {
      // Validate findings (required)
      if (!declarationConfirmed) throw new Error(t('findings.declarationRequired'));
      if (!overallFinding) throw new Error(t('findings.overallFindingRequired'));
      if (findings.some(f => !f.field_name || !f.finding || !f.description)) throw new Error(t('findings.allFieldsRequired'));

      // 1) Evidence — optional, best-effort. Uploads the real photo bytes +
      // GPS to the workflow field-evidence pipeline (multipart), which the
      // officer's review panel reads back with working images. Queue locally
      // on failure.
      if (photo && location.status === 'ready') {
        const capturedAt = new Date().toISOString();
        if (!workflowId) throw new Error(t('fieldEvidence.noWorkflow', 'This task has no workflow to attach evidence to.'));
        const form = new FormData();
        form.append('photo', photo);
        form.append('latitude', String(location.lat));
        form.append('longitude', String(location.lng));
        form.append('capturedAt', capturedAt);
        if (evidenceNotes) form.append('notes', evidenceNotes);
        try {
          await apiService.post(`/workflows/${workflowId}/field-evidence`, form, {
            headers: { 'Content-Type': undefined },
          });
          setEvidenceStatus('uploaded');
        } catch (_err) {
          // Upload failed → queue offline. If even the local save fails
          // (storage full), surface it rather than claim it was queued (API-02).
          try {
            await saveLocalEvidence({
              case_id: caseId ?? '', workflow_id: workflowId, verifier_id: '', latitude: location.lat!, longitude: location.lng!,
              accuracy_m: location.accuracy, captured_at: capturedAt, photo_hash: photoHash(photo),
              sequence: 1, notes: evidenceNotes, task_id: taskId, photo,
            });
            setEvidenceStatus('queued');
          } catch (saveErr) {
            setEvidenceStatus('save_failed');
            throw saveErr instanceof Error ? saveErr : new Error(t('fieldEvidence.saveFailed', 'Could not save evidence offline.'));
          }
        }
      }

      // 2) Findings — required. Case-scoped endpoint keyed by the real caseId.
      if (!caseId) throw new Error(t('fieldEvidence.noCase', 'Could not resolve the case for this task.'));
      await apiService.post(`/cases/${caseId}/findings`, {
        findings, overall_finding: overallFinding, declaration_confirmed: declarationConfirmed, notes, task_id: taskId,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['verifier-tasks']);
        queryClient.invalidateQueries(['verifier-assigned-tasks']);
        queryClient.invalidateQueries(['case-evidence', taskId]);
        navigate('/verifier');
      },
      onError: (err: Error) => setError(err.message),
    },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink">
          {t('verifierPortal.submitReportTitle', 'Submit Field Report')}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/verifier')}
          className="text-xs font-bold uppercase tracking-widest text-ink/50 hover:text-ink"
        >
          {t('verifierPortal.backToDashboard')}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* ── Evidence (optional) ───────────────────────────── */}
      <section className="border-2 border-ink/20 p-4 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-ink flex items-center gap-1.5">
          <Camera className="w-4 h-4" aria-hidden="true" />
          {t('verifierPortal.captureEvidenceTitle')}
          <span className="ml-1 text-ink/40 font-normal normal-case tracking-normal">({t('common.optional', 'optional')})</span>
        </h2>

        <label
          htmlFor={`photo-${taskId}`}
          className="flex items-center justify-center gap-2 border-2 border-dashed border-ink/40 px-3.5 py-6 text-sm text-ink/70 cursor-pointer hover:border-ink transition"
        >
          <Camera className="w-5 h-5 shrink-0" aria-hidden="true" />
          {photo ? photo.name : t('fieldEvidence.takeOrChoosePhoto')}
        </label>
        <input id={`photo-${taskId}`} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoChange} />
        {photoPreview && <img src={photoPreview} alt="preview" className="mt-1 max-w-xs border-2 border-ink" />}

        <div>
          <button
            type="button"
            onClick={captureLocation}
            disabled={location.status === 'locating'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-accent text-ink font-bold text-xs uppercase tracking-widest hover:bg-accent/80 transition disabled:opacity-50"
          >
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            {location.status === 'locating' ? t('fieldEvidence.locating') : t('fieldEvidence.captureLocation')}
          </button>
          {location.status === 'ready' && (
            <p className="flex items-center gap-1.5 text-xs text-primary mt-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {t('fieldEvidence.locationCaptured', { lat: location.lat!.toFixed(5), lng: location.lng!.toFixed(5), accuracy: location.accuracy?.toFixed(1) || '0' })}
            </p>
          )}
          {location.status === 'error' && (
            <p className="flex items-center gap-1.5 text-xs text-secondary-strong mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {location.error}
            </p>
          )}
        </div>

        <textarea
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
          rows={2}
          placeholder={t('fieldEvidence.notesPlaceholder')}
        />
        {evidenceStatus === 'queued' && (
          <p className="flex items-center gap-1.5 text-xs text-secondary-strong">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {t('fieldEvidence.localSaveMessage')}
          </p>
        )}
      </section>

      {/* ── Findings (required) ───────────────────────────── */}
      <section className="border-2 border-ink p-4 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-ink flex items-center gap-1.5">
          <CheckSquare className="w-4 h-4" aria-hidden="true" />
          {t('verifierPortal.submitFindingsTitle')}
        </h2>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
            {t('findings.fieldsToVerify')}
          </label>
          {findings.map((finding, index) => (
            <div key={index} className="space-y-2 mb-3 p-3 border-2 border-ink/20">
              <input
                type="text"
                placeholder={t('findings.fieldNamePlaceholder')}
                value={finding.field_name}
                onChange={(e) => handleFindingChange(index, 'field_name', e.target.value)}
                className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
              />
              <select
                value={finding.finding}
                onChange={(e) => handleFindingChange(index, 'finding', e.target.value)}
                className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
              >
                <option value="">{t('findings.selectFinding')}</option>
                {FINDING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
              </select>
              <textarea
                placeholder={t('findings.descriptionPlaceholder')}
                value={finding.description}
                onChange={(e) => handleFindingChange(index, 'description', e.target.value)}
                className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
                rows={2}
              />
              {findings.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFinding(index)}
                  className="text-xs font-bold uppercase tracking-widest text-secondary-strong hover:text-secondary hover:underline"
                >
                  {t('findings.removeFinding')}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addFinding}
            className="text-xs font-bold uppercase tracking-widest text-ink hover:text-primary underline"
          >
            + {t('findings.addFinding')}
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
            {t('findings.overallFinding')}
          </label>
          <select
            value={overallFinding}
            onChange={(e) => setOverallFinding(e.target.value)}
            className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
          >
            <option value="">{t('findings.selectOverallFinding')}</option>
            {FINDING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor={`fnotes-${taskId}`} className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
            {t('findings.notesLabel')}
          </label>
          <textarea
            id={`fnotes-${taskId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
            rows={2}
            placeholder={t('findings.notesPlaceholder')}
          />
        </div>

        <div className="flex items-start gap-2 border-2 border-ink p-3 bg-surface">
          <input id="declaration" type="checkbox" checked={declarationConfirmed} onChange={(e) => setDeclarationConfirmed(e.target.checked)} className="mt-0.5" />
          <label htmlFor="declaration" className="text-xs font-bold uppercase tracking-widest text-ink">
            {t('findings.declarationText')}
          </label>
        </div>
      </section>

      <button
        type="button"
        id="submit-report"
        onClick={() => submitMutation.mutate()}
        disabled={!declarationConfirmed || !overallFinding || submitMutation.isPending}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        {submitMutation.isPending ? (
          <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
        ) : (
          <>
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            {t('verifierPortal.submitReportCta', 'Submit Report')}
          </>
        )}
      </button>
    </div>
  );
};

export default TaskSubmissionPage;
