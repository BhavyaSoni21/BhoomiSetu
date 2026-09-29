import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import QueryError from '../../components/QueryError';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import AiChat from '../../components/ai/ai-chat';
import BackButton from '../../components/BackButton';
import { MapPin, Plus } from 'lucide-react';

const GetAssistancePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedParcelId, setSelectedParcelId] = useState<string>('');
  // When redirected through a specific parcel (?parcelId=... from My Parcels),
  // lock the request to it - no parcel switcher.
  const lockedParcelId = searchParams.get('parcelId') || '';

  const { data, isLoading, isError, refetch } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );

  const allParcels = data?.parcels ?? [];
  const registeredParcels = allParcels.filter((p) => p.status === 'Registered' || (!p.status && true));
  const isLocked = !!lockedParcelId && registeredParcels.some((p) => p.id === lockedParcelId);
  const lockedParcel = registeredParcels.find((p) => p.id === lockedParcelId);

  useEffect(() => {
    if (!isLoading && data && registeredParcels.length === 0) {
      navigate('/citizen/parcels?from=get-assistance', { replace: true });
    }
  }, [data, isLoading, navigate, registeredParcels.length]);

  useEffect(() => {
    const urlParcelId = searchParams.get('parcelId');
    if (urlParcelId && registeredParcels.some((p) => p.id === urlParcelId)) {
      setSelectedParcelId(urlParcelId);
    } else if (registeredParcels.length === 1 && !selectedParcelId) {
      setSelectedParcelId(registeredParcels[0].id);
    }
  }, [searchParams, registeredParcels, selectedParcelId]);

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-8 animate-fade-up">
        <BackButton />
        <div className="text-center py-12 text-sm text-text-muted">
          {t('aiChat.loadingParcels', 'Loading your land holdings...')}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl space-y-8 animate-fade-up">
        <BackButton />
        <QueryError onRetry={() => refetch()} message={t('aiChat.loadParcelsError', 'Unable to load your land holdings. Please try again.')} />
      </div>
    );
  }

  if (registeredParcels.length === 0) {
    return (
      <div className="max-w-2xl space-y-8 animate-fade-up">
        <BackButton />
        <div className="gov-card p-8 sm:p-10 text-center bg-surface-2 border-2 border-gov-border shadow-hard-sm space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 flex items-center justify-center border border-amber-300 dark:border-amber-800">
            <MapPin className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-heading font-bold text-lg text-text-heading">
              {t('aiChat.noParcelsHeading', 'No registered parcels on your profile')}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {t('aiChat.noParcelsDesc', 'A citizen can only raise complaints or requests against parcels linked and verified on their profile. Please link a parcel to unlock the Get Assistance flow.')}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/citizen/parcels?from=get-assistance')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs uppercase tracking-wider shadow-hard-sm transition active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>{t('aiChat.linkParcelButton', 'Link a Parcel to Get Started')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 animate-fade-up">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('aiChat.heading', 'Get Assistance')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('aiChat.pageDesc', 'Describe your land-related issue and get help filing a formal case.')}
        </p>
      </div>

      {registeredParcels.length > 1 && !isLocked && (
        <div className="mb-4">
          <label htmlFor="assistanceParcelSelect" className="block text-sm font-heading font-bold text-text-heading mb-1">
            {t('aiChat.selectParcelLabel', 'Select a Parcel')}
          </label>
          <select
            id="assistanceParcelSelect"
            value={selectedParcelId}
            onChange={(e) => setSelectedParcelId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gov-border bg-surface-1 text-text-heading font-mono text-sm focus:outline-none focus:border-brand-700"
          >
            <option value="">{t('aiChat.parcelSelectPlaceholder', '-- Select a registered parcel --')}</option>
            {registeredParcels.map((parcel) => (
              <option key={parcel.id} value={parcel.id}>
                {parcel.localId || (parcel.ulpin ? `ULPIN: ${parcel.ulpin}` : `Parcel #${parcel.id.substring(0, 8)}`)} - {parcel.stateCode}/{parcel.districtCode} ({parcel.areaSqM.toLocaleString()} m²)
              </option>
            ))}
          </select>
        </div>
      )}

      {isLocked && lockedParcel && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-gov-border bg-surface-2 text-sm text-text-heading">
          <MapPin className="w-4 h-4 text-brand-900 shrink-0" />
          <span className="font-mono">
            {lockedParcel.localId || (lockedParcel.ulpin ? `ULPIN: ${lockedParcel.ulpin}` : `Parcel #${lockedParcel.id.substring(0, 8)}`)} - {lockedParcel.stateCode}/{lockedParcel.districtCode}
          </span>
        </div>
      )}

      {selectedParcelId && (
        <div className="gov-card p-6 shadow-hard-sm">
          <AiChat parcelId={selectedParcelId} />
        </div>
      )}
    </div>
  );
};

export default GetAssistancePage;
