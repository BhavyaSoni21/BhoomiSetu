import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import DocumentVerificationPanel from '../../features/document-verification/DocumentVerificationPanel';

// Moved as-is from the old single-page CitizenPortal.tsx. There, the parcel
// context came for free from whatever ParcelSearch/MapComponent had already
// selected on the same page; standing alone here, an optional dropdown of
// the citizen's own parcels (same 'my-parcels' query MyParcels.tsx/the
// Dashboard use) fills that role instead - verification itself never
// required a parcel selection (selectedParcelId is nullable), this is purely
// a convenience for citizens who want the checked document tied to a
// specific parcel of theirs.
const VerifyDocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  const { data } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-black uppercase tracking-tight font-display text-ink mb-1">
        {t('citizenPortal.verifyDocumentsHeading')}
      </h1>
      <p className="text-xs text-ink/60 mb-4">{t('citizenPortal.verifyDocumentsDesc')}</p>

      {!!data?.parcels.length && (
        <div className="mb-4">
          <label htmlFor="verifyParcelSelect" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">
            {t('citizenPortal.verifyDocumentsParcelLabel')}
          </label>
          <select
            id="verifyParcelSelect"
            value={selectedParcelId ?? ''}
            onChange={(e) => setSelectedParcelId(e.target.value || null)}
            className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-primary"
          >
            <option value="">{t('citizenPortal.verifyDocumentsParcelPlaceholder')}</option>
            {data!.parcels.map((parcel) => (
              <option key={parcel.id} value={parcel.id}>
                {parcel.ulpin ?? `Parcel #${parcel.id.substring(0, 8)}...`} ({parcel.stateCode}-{parcel.districtCode})
              </option>
            ))}
          </select>
        </div>
      )}

      <DocumentVerificationPanel selectedParcelId={selectedParcelId} />
    </div>
  );
};

export default VerifyDocumentsPage;
