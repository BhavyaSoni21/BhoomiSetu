import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Paperclip, Search, Flag } from 'lucide-react';
import apiService from '../../services/apiService';
import ParcelSearch from '../parcels/ParcelSearch';
import ServiceRequestForm from '../parcels/ServiceRequestForm';
import { ParcelSummary } from '../../types/parcel';

interface IdentifyResult {
  extractedText: string;
  ocrConfidence: number;
  candidates: ParcelSummary[];
}

// Upload-first Land Claim (docs/FRONTEND_UPGRADE_SPEC.md follow-up, 2026-09-09):
// the citizen uploads their land document; the system OCRs it and identifies
// which real parcel it's for (POST /parcels/identify-from-document), rather
// than the citizen searching for it themselves. Exactly one confident match
// is offered as a one-click confirmation; zero or multiple matches fall back
// to the existing ParcelSearch component so the citizen can pick manually -
// the same uploaded file travels forward either way. The actual parcel<->
// citizen link only happens after officer approval (WorkflowsService.reviewStep,
// unchanged) - this panel only ever gets as far as filing the request.
interface LandClaimPanelProps {
  // Fires whenever this panel's flow closes (cancelled or actually
  // submitted, same as reset() below) - lets an embedding page (e.g. an
  // expanded "New Claim" section on the dashboard) collapse itself back
  // down without this panel needing to know anything about its container.
  onSubmitted?: () => void;
}

const LandClaimPanel: React.FC<LandClaimPanelProps> = ({ onSubmitted }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [confirmedParcel, setConfirmedParcel] = useState<ParcelSummary | null>(null);
  // A Land Claim conflict (the identified/chosen parcel is already linked to
  // someone else) offers a real next step: file a Dispute for that same
  // parcel, carrying the same uploaded document as evidence, instead of a
  // dead end (docs/FRONTEND_UPGRADE_SPEC.md follow-up).
  const [disputeMode, setDisputeMode] = useState(false);

  const identifyMutation = useMutation<IdentifyResult, Error, File>(async (selectedFile) => {
    const formData = new FormData();
    formData.append('document', selectedFile);
    const response = await apiService.post('/parcels/identify-from-document', formData, { headers: { 'Content-Type': undefined } });
    return response.data;
  });

  const { data: myParcels } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );
  const myParcelIds = new Set((myParcels?.parcels ?? []).map((p) => p.id));

  const reset = () => {
    setFile(null);
    setShowManualSearch(false);
    setConfirmedParcel(null);
    setDisputeMode(false);
    identifyMutation.reset();
    onSubmitted?.();
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setShowManualSearch(false);
    setConfirmedParcel(null);
    identifyMutation.reset();
  };

  const candidates = identifyMutation.data?.candidates ?? [];
  const revealManualSearch = showManualSearch || (identifyMutation.isSuccess && candidates.length !== 1);

  if (confirmedParcel && file) {
    return disputeMode ? (
      <ServiceRequestForm
        parcelId={confirmedParcel.id}
        workflowType="DISPUTE_FILING"
        title="File a Dispute"
        initialFile={file}
        onClose={reset}
      />
    ) : (
      <ServiceRequestForm
        parcelId={confirmedParcel.id}
        workflowType="LAND_CLAIM_REQUEST"
        title="Claim This Parcel"
        initialFile={file}
        onConflict={() => setDisputeMode(true)}
        onClose={reset}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="landClaimDocumentInput"
          className="flex items-center gap-2 border-2 border-dashed border-ink/40 px-3.5 py-2.5 text-sm text-ink/70 cursor-pointer hover:border-ink transition"
        >
          <Paperclip className="w-4 h-4 shrink-0" aria-hidden="true" />
          {file ? file.name : t('citizenPortal.landClaimUploadLabel')}
        </label>
        <input
          id="landClaimDocumentInput"
          type="file"
          accept="image/*"
          aria-label={t('citizenPortal.landClaimUploadLabel')}
          className="sr-only"
          onChange={handleFileChosen}
        />
        <button
          type="button"
          disabled={!file || identifyMutation.isLoading}
          onClick={() => file && identifyMutation.mutate(file)}
          className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          {identifyMutation.isLoading ? t('citizenPortal.landClaimIdentifying') : t('citizenPortal.landClaimUploadCta')}
        </button>
      </div>

      {identifyMutation.isError && (
        <p className="text-sm font-medium text-secondary-strong">{t('citizenPortal.landClaimIdentifyError')}</p>
      )}

      {identifyMutation.isSuccess && candidates.length === 1 && !showManualSearch && (
        <div className="border-2 border-ink bg-surface p-4 space-y-3">
          <p className="text-sm font-bold text-ink">{t('citizenPortal.landClaimConfirmQuestion')}</p>
          <p className="text-sm text-ink/70">
            {candidates[0].ulpin ?? `Parcel #${candidates[0].id.substring(0, 8)}...`} ({candidates[0].stateCode}-{candidates[0].districtCode}) &middot;{' '}
            {candidates[0].areaSqM.toLocaleString()} m²
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmedParcel(candidates[0])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold uppercase tracking-wide border-2 border-ink hover:bg-primary-strong transition"
            >
              {t('citizenPortal.landClaimConfirmCta')}
            </button>
            <button
              onClick={() => setShowManualSearch(true)}
              className="px-3 py-1.5 border-2 border-ink text-ink text-xs font-bold uppercase tracking-wide hover:bg-muted transition"
            >
              {t('citizenPortal.landClaimNotThisOne')}
            </button>
          </div>
        </div>
      )}

      {identifyMutation.isSuccess && candidates.length === 0 && !showManualSearch && (
        <p className="text-sm text-ink/60">{t('citizenPortal.landClaimNoMatch')}</p>
      )}
      {identifyMutation.isSuccess && candidates.length > 1 && !showManualSearch && (
        <p className="text-sm text-ink/60">{t('citizenPortal.landClaimMultipleMatches')}</p>
      )}

      {revealManualSearch && file && (
        <ParcelSearch
          renderResultAction={(parcel) =>
            myParcelIds.has(parcel.id) ? (
              <span className="block px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">{t('citizenPortal.landClaimAlreadyYours')}</span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmedParcel(parcel);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary text-white text-xs font-bold uppercase tracking-wide border-2 border-ink hover:bg-secondary-strong transition"
              >
                <Flag className="w-3 h-3" aria-hidden="true" />
                {t('citizenPortal.landClaimClaimCta')}
              </button>
            )
          }
        />
      )}
    </div>
  );
};

export default LandClaimPanel;
