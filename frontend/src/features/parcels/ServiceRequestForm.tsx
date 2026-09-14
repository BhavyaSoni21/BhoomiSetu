import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, LogIn, Send, UserPlus, Paperclip, MessageSquareWarning } from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser } from '../auth/auth';
import { Workflow } from '../../types/workflow';
import { ParcelDocument } from '../../types/parcelDocument';

interface ServiceRequestFormProps {
  parcelId: string;
  workflowType: string;
  title: string;
  onClose: () => void;
  // Pre-attached file (e.g. carried over from LandClaimPanel's upload/identify
  // steps, or a failed Land Claim's evidence re-offered for a Dispute Filing) -
  // docs/FRONTEND_UPGRADE_SPEC.md follow-up.
  initialFile?: File | null;
  // Called instead of showing the generic error message when the server
  // reports a 409 conflict (only ever LAND_CLAIM_REQUEST today) - the parent
  // (LandClaimPanel) uses this to offer "File a Dispute Instead" with the
  // same file already in hand.
  onConflict?: () => void;
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({ parcelId, workflowType, title, onClose, initialFile, onConflict }) => {
  const { t } = useTranslation();
  // Backend requires an authenticated CITIZEN to create a workflow
  // (workflows.controller.ts: POST /workflows is @Roles(CITIZEN_ROLE)-guarded)
  // - a guest or signed-in staff account sees a sign-in prompt instead of the
  // working form, rather than a submit that silently 403s.
  const { data: user, isLoading: userLoading } = useAuthUser();
  const isCitizen = user?.role === 'CITIZEN';

  const [requestDetails, setRequestDetails] = useState('');
  const [file, setFile] = useState<File | null>(initialFile ?? null);

  // Verify Documents only prompts an upload when the parcel genuinely has no
  // stored papers yet (docs/FRONTEND_UPGRADE_SPEC.md follow-up, confirmed
  // 2026-09-09: "ask for papers only if missing, else fetch from backend") -
  // Land Claim always arrives here with initialFile already set (the
  // upload-first flow lives in LandClaimPanel, before this form ever mounts).
  const isVerifyDocuments = workflowType === 'DOCUMENT_VERIFICATION_REQUEST';
  const isDispute = workflowType === 'DISPUTE_FILING';
  const { data: existingDocuments } = useQuery<ParcelDocument[]>(
    ['parcel-documents', parcelId],
    async () => (await apiService.get(`/parcels/${parcelId}/documents`)).data,
    { enabled: isVerifyDocuments },
  );
  const needsUpload = isVerifyDocuments && !!existingDocuments && existingDocuments.length === 0;

  const mutation = useMutation<Workflow, Error>(async () => {
    if (file) {
      const formData = new FormData();
      formData.append('parcelId', parcelId);
      formData.append('workflowType', workflowType);
      if (requestDetails.trim()) formData.append('requestDetails', requestDetails.trim());
      formData.append('document', file);
      // apiService defaults every request to Content-Type: application/json;
      // for a FormData body that must be unset (not just relabeled) so the
      // browser can set its own multipart boundary itself - same fix already
      // established by ChangeDetectionPanel.tsx's own image upload.
      const response = await apiService.post('/workflows', formData, { headers: { 'Content-Type': undefined } });
      return response.data;
    }
    const response = await apiService.post('/workflows', {
      parcelId,
      workflowType,
      requestDetails: requestDetails.trim() || undefined,
    });
    return response.data;
  });

  const isConflict = axios.isAxiosError(mutation.error) && mutation.error.response?.status === 409;
  // Gated in JS (not just the input's own `required` attribute) so the
  // submit button's disabled state is consistent and testable, rather than
  // depending on native HTML5 constraint-validation UX.
  const missingRequiredUpload = needsUpload && !file;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (missingRequiredUpload) return;
    mutation.mutate();
  };

  if (userLoading) return null;

  if (!isCitizen) {
    return (
      <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-secondary border-2 border-ink" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-2">{title}</h3>
          <p className="text-sm text-ink/80 leading-relaxed mb-5">{t('serviceRequest.signInRequiredBody')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              {t('serviceRequest.signInCta')}
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              {t('serviceRequest.registerCta')}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-xs font-bold uppercase tracking-wider text-ink/60 hover:text-ink transition"
            >
              {t('serviceRequestForm.cancelButton')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mutation.isSuccess) {
    const workflow = mutation.data;
    return (
      <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink flex items-center justify-center" aria-hidden="true">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </span>
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-primary mb-2">{t('serviceRequestForm.successHeading')}</h3>
          <p className="text-sm text-ink/80 mb-1">
            {t('serviceRequestForm.successBodyPrefix')} <strong className="text-ink">{workflow.currentStatus}</strong>.
          </p>
          <p className="text-xs text-ink/50 font-mono mb-4">{t('serviceRequestForm.referenceIdLabel')} {workflow.id}</p>
          <div className="space-y-1 mb-4 border-t-2 border-b-2 border-ink/15 py-3 divide-y-2 divide-ink/10">
            {workflow.steps.map((step) => (
              <div key={step.id} className="flex justify-between text-sm text-ink/70 py-1 first:pt-0 last:pb-0">
                <span>{step.department.replace(/_/g, ' ')}</span>
                <span className="font-bold uppercase text-xs text-ink">{step.status}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {t('serviceRequestForm.closeButton')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-lg max-w-md w-full p-6">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-secondary border-2 border-ink" aria-hidden="true" />
        <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="requestDetailsInput" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
              {t('serviceRequestForm.reasonLabel')}
            </label>
            <textarea
              id="requestDetailsInput"
              value={requestDetails}
              onChange={(e) => setRequestDetails(e.target.value)}
              rows={4}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
              placeholder={t('serviceRequestForm.reasonPlaceholder')}
            />
          </div>

          {(needsUpload || isDispute) && (
            <div>
              <p className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
                {isDispute ? t('serviceRequestForm.supportingDocumentOptional') : t('serviceRequestForm.uploadYourPapers')}
              </p>
              <label
                htmlFor="documentUploadInput"
                className="flex items-center gap-2 border-2 border-dashed border-ink/40 px-3.5 py-2.5 text-sm text-ink/70 cursor-pointer hover:border-ink transition"
              >
                <Paperclip className="w-4 h-4 shrink-0" aria-hidden="true" />
                {file ? file.name : t('serviceRequestForm.chooseImagePlaceholder')}
              </label>
              <input
                id="documentUploadInput"
                type="file"
                accept="image/*"
                aria-label={isDispute ? t('serviceRequestForm.supportingDocumentOptional') : t('serviceRequestForm.uploadYourPapers')}
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {needsUpload && (
                <p className="text-xs text-ink/50 mt-1">{t('serviceRequestForm.noPapersHint')}</p>
              )}
            </div>
          )}

          {isConflict ? (
            <div className="border-2 border-secondary/50 bg-secondary/10 px-3.5 py-3 space-y-2">
              <p className="text-sm font-medium text-secondary-strong">
                {axios.isAxiosError(mutation.error) && mutation.error.response?.data?.message}
              </p>
              {onConflict && (
                <button
                  type="button"
                  onClick={onConflict}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-xs font-bold uppercase tracking-wide border-2 border-ink hover:bg-secondary-strong transition"
                >
                  <MessageSquareWarning className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('serviceRequestForm.fileDisputeInstead')}
                </button>
              )}
            </div>
          ) : (
            mutation.isError && (
              <p className="text-sm font-medium text-secondary-strong">{t('serviceRequestForm.submitError')}</p>
            )
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border-2 border-ink text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
            >
              {t('serviceRequestForm.cancelButton')}
            </button>
            <button
              type="submit"
              disabled={mutation.isLoading || missingRequiredUpload}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {mutation.isLoading ? t('serviceRequestForm.submittingButton') : t('serviceRequestForm.submitButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceRequestForm;
