import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { FieldEvidence } from '../../types/workflow';

interface FieldEvidenceCaptureFormProps {
  workflowId: string;
  onSubmitted?: () => void;
}

type LocationState = { status: 'idle' | 'locating' | 'ready' | 'error'; lat?: number; lng?: number; error?: string };

// Reuses ServiceRequestForm.tsx's hidden-input-behind-label file pattern
// for the photo, plus the FormData-with-Content-Type-unset multipart
// pattern already used for /workflows evidence uploads. navigator.
// geolocation is genuinely new to this codebase - the actual "geotagged"
// part of a Verifier's field evidence.
const FieldEvidenceCaptureForm: React.FC<FieldEvidenceCaptureFormProps> = ({ workflowId, onSubmitted }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [notes, setNotes] = useState('');

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocation({ status: 'error', error: t('fieldEvidence.geolocationUnsupported') });
      return;
    }
    setLocation({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => setLocation({ status: 'ready', lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setLocation({ status: 'error', error: t('fieldEvidence.locationPermissionDenied') }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submitMutation = useMutation(
    async () => {
      const formData = new FormData();
      formData.append('photo', file!);
      formData.append('latitude', String(location.lat));
      formData.append('longitude', String(location.lng));
      formData.append('capturedAt', capturedAt!);
      if (notes.trim()) formData.append('notes', notes.trim());
      // Content-Type must be unset (not just relabeled) so the browser sets
      // its own multipart boundary - same fix as ServiceRequestForm.tsx.
      const response = await apiService.post(`/workflows/${workflowId}/field-evidence`, formData, { headers: { 'Content-Type': undefined } });
      return response.data as FieldEvidence;
    },
    {
      onSuccess: () => {
        setFile(null);
        setCapturedAt(null);
        setLocation({ status: 'idle' });
        setNotes('');
        queryClient.invalidateQueries(['field-evidence', workflowId]);
        onSubmitted?.();
      },
    },
  );

  const canSubmit = !!file && location.status === 'ready' && !submitMutation.isLoading;

  return (
    <div className="border-2 border-ink p-3 space-y-3 bg-surface">
      <div>
        <label
          htmlFor={`photo-${workflowId}`}
          className="flex items-center gap-2 border-2 border-dashed border-ink/40 px-3.5 py-2.5 text-sm text-ink/70 cursor-pointer hover:border-ink transition"
        >
          <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
          {file ? file.name : t('fieldEvidence.takeOrChoosePhoto')}
        </label>
        <input
          id={`photo-${workflowId}`}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
            if (selected) setCapturedAt(new Date().toISOString());
          }}
        />
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
            {t('fieldEvidence.locationCaptured', { lat: location.lat!.toFixed(5), lng: location.lng!.toFixed(5) })}
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
        <label htmlFor={`notes-${workflowId}`} className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
          {t('fieldEvidence.notesLabel')}
        </label>
        <textarea
          id={`notes-${workflowId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
          rows={2}
          placeholder={t('fieldEvidence.notesPlaceholder')}
        />
      </div>

      {submitMutation.isError && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-secondary-strong">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('fieldEvidence.submitError')}
        </p>
      )}

      <button
        type="button"
        onClick={() => submitMutation.mutate()}
        disabled={!canSubmit}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white font-bold text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
      >
        {submitMutation.isLoading ? t('fieldEvidence.submitting') : t('fieldEvidence.submitCta')}
      </button>
    </div>
  );
};

export default FieldEvidenceCaptureForm;
