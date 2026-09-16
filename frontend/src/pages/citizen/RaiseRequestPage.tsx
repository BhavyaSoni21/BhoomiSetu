import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import {
  FileText,
  Flag,
  MessageSquareWarning,
  MapPin,
  ShieldCheck,
  Send,
  HelpCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import ServiceRequestForm from '../../features/parcels/ServiceRequestForm';
import BackButton from '../../components/BackButton';

const RaiseRequestPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedParcelId, setSelectedParcelId] = useState<string>('');
  const [serviceRequest, setServiceRequest] = useState<{ workflowType: string; title: string } | null>(null);

  const { data, isLoading } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );

  const allParcels = data?.parcels ?? [];
  const registeredParcels = allParcels.filter(
    (p) => p.status === 'Registered' || (!p.status && true)
  );
  const pendingParcels = allParcels.filter(
    (p) => p.status === 'Pending Verification'
  );

  // Auto-select if passed via search param
  useEffect(() => {
    const urlParcelId = searchParams.get('parcelId');
    if (urlParcelId && registeredParcels.some((p) => p.id === urlParcelId)) {
      setSelectedParcelId(urlParcelId);
    } else if (registeredParcels.length === 1 && !selectedParcelId) {
      setSelectedParcelId(registeredParcels[0].id);
    }
  }, [searchParams, registeredParcels]);

  const selectedParcel = registeredParcels.find((p) => p.id === selectedParcelId) ?? null;

  const services = [
    {
      type: 'ROR_COPY_REQUEST',
      title: t('raiseRequestPage.service.rorTitle', 'Certified RoR / 7/12 Extract'),
      desc: t('raiseRequestPage.service.rorDesc', 'Request an digitally signed copy of your land Record of Rights extract.'),
      sla: t('raiseRequestPage.service.rorSla', '2 Business Days'),
      Icon: FileText,
      accent: 'brand',
    },
    {
      type: 'CORRECTION_REQUEST',
      title: t('raiseRequestPage.service.correctionTitle', 'Record Correction / Mutation Request'),
      desc: t('raiseRequestPage.service.correctionDesc', 'Submit boundary, spelling, or title entry correction requests.'),
      sla: t('raiseRequestPage.service.correctionSla', '7 Business Days'),
      Icon: Flag,
      accent: 'amber',
    },
    {
      type: 'DISPUTE_FILING',
      title: t('raiseRequestPage.service.disputeTitle', 'Boundary Dispute / Encumbrance Grievance'),
      desc: t('raiseRequestPage.service.disputeDesc', 'File formal complaints against encroaching or conflicting claims.'),
      sla: t('raiseRequestPage.service.disputeSla', '15 Business Days'),
      Icon: MessageSquareWarning,
      accent: 'red',
    },
    {
      type: 'DOCUMENT_VERIFICATION_REQUEST',
      title: t('raiseRequestPage.service.verificationTitle', 'Document Re-Verification Request'),
      desc: t('raiseRequestPage.service.verificationDesc', 'Request official survey re-verification of property deeds.'),
      sla: t('raiseRequestPage.service.verificationSla', '5 Business Days'),
      Icon: ShieldCheck,
      accent: 'brand',
    },
  ];

  return (
    <div className="max-w-4xl space-y-8 animate-fade-up">
      {serviceRequest && selectedParcel && (
        <ServiceRequestForm
          parcelId={selectedParcel.id}
          workflowType={serviceRequest.workflowType}
          title={serviceRequest.title}
          onClose={() => setServiceRequest(null)}
        />
      )}

      <BackButton />
      
      {/* Header */}
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-action-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Send className="w-4 h-4" />
          <span>{t('raiseRequestPage.pageSubtitle', 'Grievance Redressal & Citizen Requests')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('citizenPortal.raiseRequestHeading', 'Raise Service Request / Complaint')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('raiseRequestPage.pageDesc', 'File formal land administration requests, corrections, or disputes.')}
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-text-muted">
          {t('raiseRequestPage.loadingParcels', 'Loading your land holdings...')}
        </div>
      ) : registeredParcels.length === 0 ? (
        /* Empty State / Gate: No Registered Parcels */
        <div className="gov-card p-8 sm:p-10 text-center bg-surface-2 border-2 border-gov-border shadow-hard-sm space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 flex items-center justify-center border border-amber-300 dark:border-amber-800">
            <MapPin className="w-8 h-8" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-heading font-bold text-lg text-text-heading">
              {t('raiseRequestPage.noParcelsHeading', 'No registered parcels on your profile')}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {t(
                'raiseRequestPage.noParcelsDesc',
                'A citizen can only raise complaints or requests against parcels linked and verified on their profile. Please link a parcel to unlock the request form.'
              )}
            </p>
          </div>

          {pendingParcels.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                {t(
                  'raiseRequestPage.pendingParcelsNotice',
                  'You have {{count}} parcel(s) currently under officer review.',
                  { count: pendingParcels.length }
                )}
              </span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/citizen/parcels?from=raise-request')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs uppercase tracking-wider shadow-hard-sm transition active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>{t('raiseRequestPage.linkParcelButton', 'Link a Parcel to Get Started')}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Normal Request Flow */
        <div className="space-y-6">
          {/* Step 1: Parcel Selection */}
          <div className="gov-card p-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-900 text-white text-xs font-bold flex items-center justify-center font-mono">
                  1
                </span>
                <label
                  htmlFor="raiseRequestParcelSelect"
                  className="text-sm font-heading font-bold text-text-heading"
                >
                  {t('raiseRequestPage.selectParcelLabel', 'Select Verified Parcel')}
                </label>
              </div>

              {pendingParcels.length > 0 && (
                <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300">
                  {pendingParcels.length} pending review
                </span>
              )}
            </div>

            <select
              id="raiseRequestParcelSelect"
              value={selectedParcelId}
              onChange={(e) => setSelectedParcelId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gov-border bg-surface-1 text-text-heading font-mono text-sm focus:outline-none focus:border-brand-700"
            >
              <option value="">{t('raiseRequestPage.parcelSelectPlaceholder', '-- Select a registered parcel --')}</option>
              {registeredParcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {parcel.localId || (parcel.ulpin ? `ULPIN: ${parcel.ulpin}` : `Parcel #${parcel.id.substring(0, 8)}`)} — {parcel.stateCode}-{parcel.districtCode} ({parcel.areaSqM.toLocaleString()} m²)
                </option>
              ))}
            </select>

            {/* Selected Parcel Summary Card */}
            {selectedParcel && (
              <div className="mt-4 p-4 rounded-xl bg-surface-2 border border-gov-border">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-900">
                        {selectedParcel.localId || selectedParcel.ulpin || `ID: ${selectedParcel.id.substring(0, 10)}`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-green-100 text-green-800">
                        {t('raiseRequestPage.activeHoldingBadge', 'Verified Holding')}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {t('raiseRequestPage.regionLabel', 'Region')}: <span className="font-semibold text-text-heading">{selectedParcel.stateCode} / District {selectedParcel.districtCode}</span> · Locality: <span className="font-mono">{selectedParcel.localBodyCode}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-text-muted">{t('raiseRequestPage.totalRegisteredAreaLabel', 'Registered Area')}</span>
                    <p className="text-base font-heading font-bold text-brand-900">
                      {selectedParcel.areaSqM.toLocaleString()} m²
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Choose Service Type */}
          {selectedParcel && (
            <div className="gov-card p-6 animate-fade-up">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-brand-900 text-white text-xs font-bold flex items-center justify-center font-mono">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-heading font-bold text-text-heading">
                    {t('raiseRequestPage.selectServiceHeading', 'Select Service Request or Grievance Type')}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    {t('raiseRequestPage.selectServiceDesc', 'Choose the official workflow pipeline for this land record')}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {services.map((s) => {
                  const Icon = s.Icon;
                  return (
                    <div
                      key={s.type}
                      className="p-5 rounded-xl border border-gov-border bg-surface-1 hover:border-brand-700 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-brand-900/10 text-brand-900">
                            <Icon className="w-5 h-5" aria-hidden="true" />
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-text-muted">
                            <Clock className="w-3 h-3" />
                            {s.sla}
                          </span>
                        </div>
                        <h3 className="font-heading font-bold text-sm text-text-heading">
                          {s.title}
                        </h3>
                        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-gov-border">
                        <button
                          type="button"
                          onClick={() => setServiceRequest({ workflowType: s.type, title: s.title })}
                          className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-heading font-bold text-white transition-all active:scale-98"
                          style={{
                            background: s.accent === 'amber' ? 'var(--action-600)' : 'var(--brand-900)',
                          }}
                        >
                          <span>{t('raiseRequestPage.applyNowButton', 'Continue to Request Form')}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RaiseRequestPage;
