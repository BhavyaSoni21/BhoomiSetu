import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText, Flag, MessageSquareWarning, MapPin } from 'lucide-react';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import ServiceRequestForm from '../../features/parcels/ServiceRequestForm';

// [new restriction] (docs/FRONTEND_UPGRADE_SPEC.md §4): unlike Parcel 360's
// own "Actions" buttons (which file a request against whatever parcel the
// citizen is currently viewing, for anyone signed in as CITIZEN), this page
// is the standalone entry point that lists *only* the citizen's own parcels
// (GET /parcels/mine - the same association the backend itself now enforces
// via workflows.controller.ts's isCitizenAssociatedWithParcel check) as a
// dropdown, not a free-text parcel id field, and auto-fills the read-only
// details below it once one is picked. Reuses ServiceRequestForm exactly as
// Parcel 360 does, once a parcelId is actually chosen.
const RaiseRequestPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedParcelId, setSelectedParcelId] = useState<string>('');
  const [serviceRequest, setServiceRequest] = useState<{ workflowType: string; title: string } | null>(null);

  const { data, isLoading } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );

  const selectedParcel = data?.parcels.find((p) => p.id === selectedParcelId) ?? null;

  return (
    <div className="max-w-2xl">
      {serviceRequest && selectedParcel && (
        <ServiceRequestForm
          parcelId={selectedParcel.id}
          workflowType={serviceRequest.workflowType}
          title={serviceRequest.title}
          onClose={() => setServiceRequest(null)}
        />
      )}

      <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink mb-1">
        {t('citizenPortal.raiseRequestHeading')}
      </h1>
      <p className="text-xs text-ink/60 mb-5">{t('citizenPortal.raiseRequestDesc')}</p>

      {isLoading ? null : data!.total === 0 ? (
        <p className="text-sm text-ink/70 bg-surface border-2 border-ink/20 p-4">{t('citizenPortal.raiseRequestNoParcels')}</p>
      ) : (
        <>
          <div className="mb-5">
            <label htmlFor="raiseRequestParcelSelect" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
              {t('citizenPortal.raiseRequestParcelLabel')}
            </label>
            <select
              id="raiseRequestParcelSelect"
              value={selectedParcelId}
              onChange={(e) => setSelectedParcelId(e.target.value)}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-primary"
            >
              <option value="">{t('citizenPortal.raiseRequestParcelPlaceholder')}</option>
              {data!.parcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {parcel.ulpin ?? `Parcel #${parcel.id.substring(0, 8)}...`} ({parcel.stateCode}-{parcel.districtCode})
                </option>
              ))}
            </select>
          </div>

          {selectedParcel && (
            <>
              {/* Minimum data entry (docs/FRONTEND_UPGRADE_SPEC.md §9 item 3):
                  read-only, auto-fetched from the same /parcels/mine response
                  used for the dropdown above - no re-typing what's already known. */}
              <div className="mb-5 bg-surface border-2 border-ink/20 p-4 space-y-1">
                <p className="text-sm text-ink/80 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span className="font-bold text-ink">{selectedParcel.ulpin ? `ULPIN: ${selectedParcel.ulpin}` : 'No ULPIN'}</span>
                </p>
                <p className="text-sm text-ink/70">
                  {selectedParcel.canonicalParcelId && <>Canonical ID: {selectedParcel.canonicalParcelId} · </>}
                  {selectedParcel.stateCode}-{selectedParcel.districtCode}-{selectedParcel.localBodyCode}
                </p>
                <p className="text-sm text-ink/70">Area: {selectedParcel.areaSqM.toLocaleString()} m²</p>
              </div>

              <h2 className="text-sm font-black uppercase tracking-widest text-ink/60 mb-3">
                {t('citizenPortal.raiseRequestTypeHeading')}
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setServiceRequest({ workflowType: 'ROR_COPY_REQUEST', title: 'Request a Copy of Record of Rights (RoR)' })}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  Request Documents
                </button>
                <button
                  onClick={() => setServiceRequest({ workflowType: 'CORRECTION_REQUEST', title: 'Report an Issue / Request a Correction' })}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                  Report Issue
                </button>
                <button
                  onClick={() =>
                    setServiceRequest({ workflowType: 'DISPUTE_FILING', title: 'File a Dispute (Ownership, Boundary, Inheritance, or Encroachment)' })
                  }
                  className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <MessageSquareWarning className="w-3.5 h-3.5" aria-hidden="true" />
                  File a Dispute
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default RaiseRequestPage;
