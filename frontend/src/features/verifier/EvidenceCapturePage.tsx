import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import apiService from '../../services/apiService';
import { saveLocalEvidence, getLocalQueue } from '../../services/verifierLocalSyncService';

type LocationState = { status: 'idle' | 'locating' | 'ready' | 'error'; lat?: number; lng?: number; accuracy?: number; error?: string };

const EvidenceCapturePage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [notes, setNotes] = useState('');
  const [sequence, setSequence] = useState(1);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'failed'>('idle');

  useEffect(() => {
    const queue = getLocalQueue();
    if (queue.length > 0) {
      setUploadStatus('failed');
    }
  }, []);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocation({ status: 'error', error: t('fieldEvidence.geolocationUnsupported') });
      return;
    }
    setLocation({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({
        status: 'ready',
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => setLocation({ status: 'error', error: t('fieldEvidence.locationPermissionDenied') }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setCapturedAt(new Date().toISOString());
    } else {
      setPhotoPreview(null);
      setCapturedAt(null);
    }
  };

  const photoHash = (photo: File): string => `${photo.name}-${photo.size}-${photo.lastModified}`;

  const submitMutation = useMutation(
    async () => {
      setUploadStatus('uploading');
      let evidenceId: string | null = null;

      if (photo && location.status === 'ready') {
        const payload = {
          case_id: taskId,
          verifier_id: '',
          latitude: location.lat,
          longitude: location.lng,
          accuracy_m: location.accuracy,
          captured_at: capturedAt,
          photo_hash: photoHash(photo),
          sequence,
          notes,
          task_id: taskId,
        };

        try {
          const response = await apiService.post(`/cases/${taskId}/evidence/capture`, payload);
          evidenceId = response.data.evidence_id;
          setUploadStatus('uploaded');
        } catch (_err) {
          setUploadStatus('failed');
          saveLocalEvidence({
            case_id: taskId,
            verifier_id: '',
            latitude: location.lat!,
            longitude: location.lng!,
            accuracy_m: location.accuracy,
            captured_at: capturedAt!,
            photo_hash: photoHash(photo),
            sequence,
            notes,
            task_id: taskId,
            photo,
          });
        }
      } else {
        throw new Error('Need photo and location');
      }

      return { evidenceId, photo };
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['verifier-tasks']);
        queryClient.invalidateQueries(['case-evidence', taskId]);
      },
    },
  );

  const canSubmit = !!photo && location.status === 'ready' && !submitMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink">
          {t('verifierPortal.captureEvidenceTitle')}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/verifier')}
          className="text-xs font-bold uppercase tracking-widest text-ink/50 hover:text-ink"
        >
          {t('verifierPortal.backToDashboard')}
        </button>
      </div>

      <div>
        <label
          htmlFor={`photo-${taskId}`}
          className="flex items-center justify-center gap-2 border-2 border-dashed border-ink/40 px-3.5 py-6 text-sm text-ink/70 cursor-pointer hover:border-ink transition"
        >
          <Camera className="w-5 h-5 shrink-0" aria-hidden="true" />
          {photo ? photo.name : t('fieldEvidence.takeOrChoosePhoto')}
        </label>
        <input
          id={`photo-${taskId}`}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handlePhotoChange}
        />
        {photoPreview && (
          <img src={photoPreview} alt="preview" className="mt-2 max-w-xs border-2 border-ink" />
        )}
      </div>

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

      <div>
        <label htmlFor={`notes-${taskId}`} className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
          {t('fieldEvidence.notesLabel')}
        </label>
        <textarea
          id={`notes-${taskId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
          rows={2}
          placeholder={t('fieldEvidence.notesPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
          {t('fieldEvidence.sequenceLabel')}
        </label>
        <input
          type="number"
          min={1}
          value={sequence}
          onChange={(e) => setSequence(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 px-2 py-1 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {uploadStatus === 'failed' && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('fieldEvidence.submitError')} {t('fieldEvidence.localSaveMessage')}
        </p>
      )}

      {uploadStatus === 'uploaded' && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('fieldEvidence.uploadSuccess')}
        </p>
      )}

      <button
        type="button"
        onClick={() => submitMutation.mutate()}
        disabled={!canSubmit}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        {submitMutation.isPending ? t('fieldEvidence.submitting') : (
          <>
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            {t('fieldEvidence.submitCta')}
          </>
        )}
      </button>
    </div>
  );
};

export default EvidenceCapturePage;
