import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, FileText, Flag, History, MessageSquareWarning, ShieldCheck, Sparkles } from 'lucide-react';
import apiService from '../../services/apiService';
import MapComponent from '../map/MapComponent';
import ServiceRequestForm from './ServiceRequestForm';
import RequestNotifications from './RequestNotifications';
import AiExplanationCard from '../ai/AiExplanationCard';
import { OwnershipHistoryRecord, Parcel360Response } from '../../types/parcel360';
import { ParcelSummary } from '../../types/parcel';
import { AiExplanation } from '../../types/aiExplanation';
import { RiskScore } from '../../types/riskScore';
import { useAuthUser } from '../auth/auth';
import { OFFICER_ROLES } from '../officer/officerAuth';
import { useHistoricalClusters } from '../officer/historicalImagery';
import HistoricalMapView from '../officer/HistoricalMapView';
import HistoricalYearCompare from '../officer/HistoricalYearCompare';

type TabKey = 'overview' | 'landRecords' | 'registration' | 'planning' | 'tax' | 'restriction' | 'dispute' | 'encumbrance' | 'ownershipHistory';

const RISK_BAND_COLORS: Record<string, string> = {
  LOW: 'bg-muted text-ink/70 border-ink/20',
  MEDIUM: 'bg-accent/20 text-secondary-strong border-accent/50',
  HIGH: 'bg-secondary/15 text-secondary-strong border-secondary/50',
  CRITICAL: 'bg-secondary text-white border-ink',
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'landRecords', label: 'Land Records' },
  { key: 'registration', label: 'Registration' },
  { key: 'planning', label: 'Planning' },
  { key: 'tax', label: 'Tax' },
  { key: 'restriction', label: 'Restriction' },
  { key: 'dispute', label: 'Dispute' },
  { key: 'encumbrance', label: 'Encumbrance' },
  { key: 'ownershipHistory', label: 'Ownership History' },
];

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function NotAvailable({ department }: { department: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-ink/50 text-sm">
      No {department} data is available for this parcel.
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="text-ink/70 text-sm py-1">
      <strong className="font-bold text-ink">{label}:</strong> {value}
    </p>
  );
}

const Parcel360View: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: authUser } = useAuthUser();
  const isOfficer = !!authUser && (OFFICER_ROLES as readonly string[]).includes(authUser.role);
  const isCitizen = authUser?.role === 'CITIZEN';
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [serviceRequest, setServiceRequest] = useState<{ workflowType: string; title: string } | null>(null);
  // The two-year comparison used to navigate to /officer/historical-imagery
  // (docs/ADMIN_PANEL_ISSUES.md follow-up, per the user's explicit "the
  // compare years data in the parcel 360 should also not redirect to
  // historical analysis, this analysis should be done there only in the
  // parcel 360") - now toggled inline instead, reusing HistoricalYearCompare
  // (extracted out of HistoricalImageryPanel.tsx for exactly this).
  const [showHistoricalCompare, setShowHistoricalCompare] = useState(false);

  // Closing the form (whether cancelled or after a successful submission)
  // refreshes the notification feed below - cheapest way to make a brand new
  // request show up immediately without a manual page reload.
  const closeServiceRequest = () => {
    setServiceRequest(null);
    queryClient.invalidateQueries(['parcel-workflows', id]);
  };

  const { data: parcel360, isLoading, error } = useQuery<Parcel360Response>(
    ['parcel-360', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}/360`);
      return response.data;
    },
    { enabled: !!id },
  );

  const explainMutation = useMutation<AiExplanation, Error>(async () => {
    const response = await apiService.post(`/ai/parcels/${id}/explain`);
    return response.data;
  });

  // The 3 request buttons below (+ Verify Documents) are citizen actions for
  // THIS citizen's own parcel, not a generic "any signed-in citizen" action -
  // the backend already 403s a mismatched citizen (workflows.controller.ts's
  // isCitizenAssociatedWithParcel check), this just matches the UI to that
  // reality instead of rendering buttons that would fail on submit (and,
  // as a side effect, keeps them off an admin/officer's screen entirely -
  // docs/ADMIN_PANEL_ISSUES.md #2).
  const { data: myParcelsData } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
    { enabled: isCitizen },
  );
  const isOwnParcel = isCitizen && !!myParcelsData?.parcels.some((p) => p.id === parcel360?.parcel_id);

  // Public (2026-09-08) - when the parcel belongs to a cluster, upgrades the
  // "Parcel Map" below into the year-dropdown/dispute-colored historical
  // view, for citizens as much as staff. Cheap/cached (5 clusters total), so
  // fetched unconditionally rather than gated on parcel360.clusterId being
  // known yet.
  const { data: historicalClusters = [] } = useHistoricalClusters();
  const historicalCluster = parcel360 ? historicalClusters.find((c) => c.clusterId === parcel360.clusterId) : undefined;

  const { data: riskScore } = useQuery<RiskScore>(
    ['risk-score', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}/risk-score`);
      return response.data;
    },
    { enabled: !!id },
  );

  // Ownership history is citizen-restricted (docs/FEATURE_AUDIT.md §8a) - a
  // 401/403 here is an expected, normal response for a guest or an
  // unrelated citizen, not a real error, so it's fetched only once that tab
  // is actually opened rather than eagerly alongside the rest of Parcel 360.
  const {
    data: ownershipHistory,
    error: ownershipHistoryError,
    isLoading: ownershipHistoryLoading,
  } = useQuery<OwnershipHistoryRecord[], Error>(
    ['ownership-history', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}/ownership-history`);
      return response.data;
    },
    { enabled: !!id && activeTab === 'ownershipHistory', retry: false },
  );

  // Selecting a different parcel on the map below should replace this whole
  // view, not just move the map's own highlight - drop any open modal/tab
  // state that referred to the parcel we're navigating away from.
  useEffect(() => {
    setServiceRequest(null);
    setActiveTab('overview');
    setShowHistoricalCompare(false);
    explainMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return <div className="flex h-[600px] items-center justify-center text-ink/60 font-medium">Loading parcel details...</div>;
  }

  if (error) {
    return <div className="flex h-[600px] items-center justify-center text-secondary-strong font-medium">Error loading parcel details</div>;
  }

  if (!parcel360) {
    return <div className="flex h-[600px] items-center justify-center text-ink/60 font-medium">Parcel not found</div>;
  }

  const { identifiers, location, spatial, sources, departments } = parcel360;
  const statusByDepartment = Object.fromEntries(sources.map((s) => [s.department, s.status]));

  return (
    <div className="space-y-6">
      {serviceRequest && (
        <ServiceRequestForm
          parcelId={parcel360.parcel_id}
          workflowType={serviceRequest.workflowType}
          title={serviceRequest.title}
          onClose={closeServiceRequest}
        />
      )}

      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink" aria-hidden="true" />
        <h1 className="text-2xl font-black uppercase tracking-tight font-display text-ink mb-1">Parcel 360</h1>
        <p className="text-sm text-ink/50 font-mono mb-4">{parcel360.parcel_id}</p>

        <div className="border-b-2 border-ink/20 mb-4 overflow-x-auto">
          <nav className="-mb-px flex flex-wrap gap-1" aria-label="Parcel 360 sections">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-ink/50 hover:border-ink/30 hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">Identifiers</h2>
              <Field label="ULPIN" value={identifiers.ulpin || 'N/A'} />
              <Field label="Survey Number" value={identifiers.survey_number || 'N/A'} />
              <Field label="Plot Number" value={identifiers.plot_number || 'N/A'} />
              <Field label="Local Identifier" value={identifiers.local_identifier || 'N/A'} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">Location</h2>
              <Field label="State" value={location.state} />
              <Field label="District" value={location.district} />
              <Field label="Locality" value={location.locality} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">Area</h2>
              <Field label="Area" value={`${spatial.area_sq_m.toLocaleString()} m²`} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">Data Sources</h2>
              <div className="space-y-1.5">
                {sources.map((source) => (
                  <div key={source.department} className="flex items-center justify-between text-sm">
                    <span className="text-ink/70">{source.department.replace(/_/g, ' ')}</span>
                    <span
                      className={`border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        source.status === 'AVAILABLE' ? 'bg-primary/10 text-primary border-primary/40' : 'bg-muted text-ink/40 border-ink/20'
                      }`}
                    >
                      {source.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'landRecords' && (
          departments.landRecords ? (
            <div className="space-y-1">
              <Field label="Source Schema" value={departments.landRecords.sourceSchema} />
              <Field label="Source Identifier" value={departments.landRecords.sourceIdentifier} />
              <Field label="Owner Name" value={departments.landRecords.ownerName} />
              <Field label="Area" value={`${departments.landRecords.areaSqM.toLocaleString()} m²`} />
              <Field label="Locality" value={departments.landRecords.locality} />
            </div>
          ) : (
            <NotAvailable department={statusByDepartment.LAND_RECORDS ? 'land records' : 'land records (no matching identifier)'} />
          )
        )}

        {activeTab === 'registration' && (
          departments.registration ? (
            <div className="space-y-1">
              <Field label="Status" value={departments.registration.registrationStatus} />
              <Field label="Registration Number" value={departments.registration.registrationNumber || 'N/A'} />
              <Field label="Registration Date" value={formatDate(departments.registration.registrationDate)} />
              <Field label="Last Transaction" value={departments.registration.lastTransactionType || 'N/A'} />
              <Field label="Last Transaction Date" value={formatDate(departments.registration.lastTransactionDate)} />
            </div>
          ) : (
            <NotAvailable department="registration" />
          )
        )}

        {activeTab === 'planning' && (
          departments.planning ? (
            <div className="space-y-1">
              <Field label="Land Use" value={departments.planning.landUse} />
              <Field label="Zoning Classification" value={departments.planning.zoningClassification} />
              <Field label="Master Plan Reference" value={departments.planning.masterPlanReference} />
              <Field label="Building Permission" value={departments.planning.buildingPermissionStatus} />
            </div>
          ) : (
            <NotAvailable department="planning" />
          )
        )}

        {activeTab === 'tax' && (
          departments.tax ? (
            <div className="space-y-1">
              <Field label="Assessed Value" value={formatCurrency(departments.tax.assessedValue)} />
              <Field label="Annual Tax" value={formatCurrency(departments.tax.annualTaxAmount)} />
              <Field label="Tax Status" value={departments.tax.taxStatus} />
              <Field label="Outstanding Amount" value={formatCurrency(departments.tax.outstandingAmount)} />
              <Field label="Last Payment Date" value={formatDate(departments.tax.lastPaymentDate)} />
              <Field
                label="Market Value Reference"
                value={departments.tax.marketValueReference !== null ? formatCurrency(departments.tax.marketValueReference) : 'N/A'}
              />
              <Field label="Valuation Date" value={formatDate(departments.tax.valuationDate)} />
              <Field label="Valuation Source" value={departments.tax.valuationSource || 'N/A'} />
            </div>
          ) : (
            <NotAvailable department="tax" />
          )
        )}

        {activeTab === 'restriction' && (
          departments.restriction ? (
            <div className="space-y-1">
              <Field label="Has Restriction" value={departments.restriction.hasRestriction ? 'Yes' : 'No'} />
              {departments.restriction.hasRestriction && (
                <>
                  <Field label="Restriction Type" value={departments.restriction.restrictionType || 'N/A'} />
                  <Field label="Details" value={departments.restriction.restrictionDetails || 'N/A'} />
                  <Field label="Imposing Authority" value={departments.restriction.imposingAuthority || 'N/A'} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department="restriction" />
          )
        )}

        {activeTab === 'dispute' && (
          departments.dispute ? (
            <div className="space-y-1">
              <Field label="Has Active Dispute" value={departments.dispute.hasActiveDispute ? 'Yes' : 'No'} />
              <Field label="Dispute Type" value={departments.dispute.disputeType || 'N/A'} />
              <Field label="Case Status" value={departments.dispute.caseStatus || 'N/A'} />
              <Field label="Filing Date" value={formatDate(departments.dispute.filingDate)} />
              {!departments.dispute.hasActiveDispute && departments.dispute.caseStatus && (
                <>
                  <Field label="Resolution Date" value={formatDate(departments.dispute.resolutionDate)} />
                  <Field label="Resolution Summary" value={departments.dispute.resolutionSummary || 'N/A'} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department="dispute" />
          )
        )}

        {activeTab === 'encumbrance' && (
          departments.encumbrance ? (
            <div className="space-y-1">
              <Field label="Has Encumbrance" value={departments.encumbrance.hasEncumbrance ? 'Yes' : 'No'} />
              {departments.encumbrance.hasEncumbrance && (
                <>
                  <Field label="Encumbrance Type" value={departments.encumbrance.encumbranceType || 'N/A'} />
                  <Field label="Lender Name" value={departments.encumbrance.lenderName || 'N/A'} />
                  <Field label="Instrument Reference" value={departments.encumbrance.instrumentReference || 'N/A'} />
                  <Field label="Registered Date" value={formatDate(departments.encumbrance.registeredDate)} />
                  <Field label="Discharge Date" value={formatDate(departments.encumbrance.dischargeDate)} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department="encumbrance" />
          )
        )}

        {activeTab === 'ownershipHistory' && (
          <div>
            {ownershipHistoryLoading && <div className="text-ink/60 text-sm py-4">Loading ownership history...</div>}
            {ownershipHistoryError && (
              <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">
                {axios.isAxiosError(ownershipHistoryError) && ownershipHistoryError.response?.status === 401
                  ? 'Sign in as the citizen associated with this parcel, or as staff, to view its ownership history.'
                  : axios.isAxiosError(ownershipHistoryError) && ownershipHistoryError.response?.status === 403
                    ? 'Ownership history is only visible for parcels associated with your account.'
                    : 'Error loading ownership history.'}
              </div>
            )}
            {ownershipHistory && ownershipHistory.length === 0 && (
              <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">
                No ownership history is on file for this parcel.
              </div>
            )}
            {ownershipHistory && ownershipHistory.length > 0 && (
              <div className="space-y-1 divide-y-2 divide-ink/10">
                {ownershipHistory.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 text-sm py-2 first:pt-0 last:pb-0">
                    <div>
                      <span className="font-bold text-ink">{entry.ownerName}</span>
                      <p className="text-xs text-ink/50 mt-0.5">
                        {entry.transactionType.replace(/_/g, ' ')} · {formatDate(entry.transactionDate)}
                        {entry.documentReference ? ` · ${entry.documentReference}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <RequestNotifications parcelId={parcel360.parcel_id} />

      {riskScore && (
        <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-accent border-2 border-ink" aria-hidden="true" />
          <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-1">Risk Assessment</h2>
          <p className="text-sm text-ink/60 mb-4 leading-relaxed">
            A heuristic score combining tax, dispute, governance-alert, and restriction signals — not a prediction
            from a trained model. Each factor below is weighted by how directly it threatens undisputed ownership.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-3xl font-black text-ink">{riskScore.overallScore}</span>
            <span className={`border-2 px-3 py-1 text-xs font-bold uppercase tracking-wide ${RISK_BAND_COLORS[riskScore.riskBand] ?? 'bg-muted text-ink/70 border-ink/20'}`}>
              {riskScore.riskBand}
            </span>
            <span className="text-xs text-ink/40 font-medium">{Math.round(riskScore.dataCompleteness * 100)}% data coverage</span>
          </div>
          <div className="space-y-1 divide-y-2 divide-ink/10">
            {riskScore.factors.map((factor) => (
              <div key={factor.key} className="flex items-start justify-between gap-3 text-sm py-2 first:pt-0 last:pb-0">
                <div>
                  <span className="font-bold text-ink">{factor.label}</span>
                  <p className="text-xs text-ink/50 mt-0.5">{factor.rationale}</p>
                </div>
                <span className={factor.available ? 'font-bold text-ink whitespace-nowrap' : 'text-xs text-ink/40 italic whitespace-nowrap'}>
                  {factor.available ? factor.score : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6 overflow-hidden">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-1">Parcel Map</h2>
        <p className="text-sm text-ink/60 mb-3 leading-relaxed">
          Selected parcel is highlighted; adjacent and nearby parcels load automatically for spatial context.
          Click another parcel on the map to view its Parcel 360 details.
          {historicalCluster &&
            ' Parcels are colored by each one’s real dispute/restriction status for the year chosen below.'}
        </p>
        {historicalCluster ? (
          <HistoricalMapView
            clusterId={historicalCluster.clusterId}
            years={historicalCluster.years}
            selectedParcelId={parcel360.parcel_id}
            onParcelClick={(clickedId) => {
              if (clickedId !== parcel360.parcel_id) navigate(`/parcels/${clickedId}`);
            }}
          />
        ) : (
          <MapComponent
            parcels={[]}
            selectedParcelId={parcel360.parcel_id}
            onParcelClick={(clickedId) => {
              if (clickedId !== parcel360.parcel_id) navigate(`/parcels/${clickedId}`);
            }}
          />
        )}
      </div>

      <div className="bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {isOwnParcel && (
            <>
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
                onClick={() => setServiceRequest({ workflowType: 'DISPUTE_FILING', title: 'File a Dispute (Ownership, Boundary, Inheritance, or Encroachment)' })}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <MessageSquareWarning className="w-3.5 h-3.5" aria-hidden="true" />
                File a Dispute
              </button>
              <button
                onClick={() => setServiceRequest({ workflowType: 'DOCUMENT_VERIFICATION_REQUEST', title: 'Verify Documents' })}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Verify Documents
              </button>
            </>
          )}
          <button
            className="inline-flex items-center gap-2 border-2 border-ink bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px]"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            {/* "to Search" implies a citizen's Find Parcels flow (docs/ADMIN_PANEL_ISSUES.md
                Admin #2's last remaining piece) - an Officer/Admin viewer more often
                arrives here from a workflow, alert, or audit log entry instead, so
                the label stays neutral for them. Left visible either way (unlike
                Request Documents/Report Issue/File a Dispute/Verify Documents above,
                gated on isOwnParcel) since browser-back navigation itself isn't a
                citizen-only action. */}
            {isCitizen ? 'Back to Search' : 'Back'}
          </button>
          {isOfficer && historicalCluster && (
            <button
              onClick={() => setShowHistoricalCompare((v) => !v)}
              aria-expanded={showHistoricalCompare}
              className="inline-flex items-center gap-2 border-2 border-ink bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px]"
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              {showHistoricalCompare ? 'Hide Compare Years' : 'Compare Years & Generate Alerts'}
            </button>
          )}
          <button
            onClick={() => explainMutation.mutate()}
            disabled={explainMutation.isLoading}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-wider text-background shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {explainMutation.isLoading ? 'Asking AI...' : 'Explain with AI'}
          </button>
        </div>

        {showHistoricalCompare && historicalCluster && (
          <div className="mt-4 pt-4 border-t-2 border-ink/10">
            <h3 className="text-sm font-black uppercase tracking-widest text-ink/70 mb-3">Compare Years & Generate Alerts</h3>
            <HistoricalYearCompare key={historicalCluster.clusterId} clusterId={historicalCluster.clusterId} years={historicalCluster.years} />
          </div>
        )}

        {explainMutation.isError && (
          <p className="text-sm font-medium text-secondary-strong mt-4">
            {axios.isAxiosError(explainMutation.error) && explainMutation.error.response?.status === 503
              ? 'AI is not configured on this server.'
              : 'Something went wrong generating an explanation. Please try again.'}
          </p>
        )}
        {explainMutation.isSuccess && (
          <div className="mt-4">
            <AiExplanationCard explanation={explainMutation.data} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Parcel360View;
