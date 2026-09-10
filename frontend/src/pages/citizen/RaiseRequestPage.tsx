import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';
import apiService from '../../services/apiService';
import { ParcelSummary } from '../../types/parcel';
import ServiceRequestForm from '../../features/parcels/ServiceRequestForm';

const RaiseRequestPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedParcelId, setSelectedParcelId] = useState<string>('');
  const [serviceRequest, setServiceRequest] = useState<{ workflowType: string; title: string } | null>(null);

  const { data, isLoading } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );

  const selectedParcel = data?.parcels.find((p) => p.id === selectedParcelId) ?? null;

  const services = [
    {
      type: 'ROR_COPY_REQUEST',
      title: 'Certified RoR / 7-12 Extract',
      desc: 'Official digitally signed Record of Rights copy with government QR authentication code.',
      sla: '2 Working Days',
      Icon: FileText,
      accent: 'brand',
    },
    {
      type: 'CORRECTION_REQUEST',
      title: 'Record Name / Area Correction',
      desc: 'Rectification of clerical or spelling errors in land owner names, survey extents, or remarks.',
      sla: '7 Working Days',
      Icon: Flag,
      accent: 'amber',
    },
    {
      type: 'DISPUTE_FILING',
      title: 'Formal Land Dispute Filing',
      desc: 'Initiate legal review for boundary overlap, partition grievances, or illegal encroachment.',
      sla: '30 Days Statutory SLA',
      Icon: MessageSquareWarning,
      accent: 'red',
    },
    {
      type: 'DOCUMENT_VERIFICATION_REQUEST',
      title: 'Encumbrance & Document Verification',
      desc: 'Automated verification against bank mortgages, court stays, and registration department feeds.',
      sla: 'Instant / 24 Hours',
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

      {/* Header */}
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-action-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Send className="w-4 h-4" />
          <span>Citizen Revenue Portal · Application Submission</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('citizenPortal.raiseRequestHeading', 'Raise Service Request')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Select one of your registered land parcels to initiate a revenue workflow with guaranteed officer SLA.
        </p>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-text-muted">Loading your registered parcels…</div>
      ) : data?.total === 0 ? (
        <div className="gov-card p-8 text-center bg-surface-2 border border-gov-border">
          <MapPin className="w-10 h-10 mx-auto text-text-muted mb-3" />
          <h3 className="font-heading font-bold text-base text-text-heading">
            No registered parcels on your profile
          </h3>
          <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
            You can search public cadastre parcels or file an ownership claim under SVAMITVA to link your agricultural or residential land.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Step 1: Parcel Selection */}
          <div className="gov-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-brand-900 text-white text-xs font-bold flex items-center justify-center font-mono">
                1
              </span>
              <label
                htmlFor="raiseRequestParcelSelect"
                className="text-sm font-heading font-bold text-text-heading"
              >
                Select Target Land Parcel
              </label>
            </div>

            <select
              id="raiseRequestParcelSelect"
              value={selectedParcelId}
              onChange={(e) => setSelectedParcelId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gov-border bg-surface-1 text-text-heading font-mono text-sm focus:outline-none focus:border-brand-700"
            >
              <option value="">-- Choose a parcel to apply against --</option>
              {data?.parcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {parcel.ulpin ? `ULPIN: ${parcel.ulpin}` : `Parcel #${parcel.id.substring(0, 8)}`} — {parcel.stateCode}-{parcel.districtCode} ({parcel.areaSqM.toLocaleString()} m²)
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
                        {selectedParcel.ulpin || `ID: ${selectedParcel.id.substring(0, 10)}`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-green-100 text-green-800">
                        Active Holding
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      Region: <span className="font-semibold text-text-heading">{selectedParcel.stateCode} / District {selectedParcel.districtCode}</span> · Sub-division: <span className="font-mono">{selectedParcel.localBodyCode}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-text-muted">Total Registered Area</span>
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
                    Select Revenue Service
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Choose the type of request to file. Your application will be routed to the jurisdiction officer.
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
                          <span>Apply Now</span>
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
