import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, Download, Eye, FileText, Flag, History, MapPin, MessageSquareWarning, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import apiService from '../../services/apiService';
import UnifiedMapWrapper from '../map/UnifiedMapWrapper';
import ServiceRequestForm from './ServiceRequestForm';
import OfficialPdfViewerModal from './OfficialPdfViewerModal';
import AiExplanationCard from '../ai/AiExplanationCard';
import { OwnershipHistoryRecord, Parcel360Response } from '../../types/parcel360';
import { ParcelSummary } from '../../types/parcel';
import { resolveStateName, resolveDistrictName } from '../../data/locationData';
import { AiExplanation } from '../../types/aiExplanation';
import { RiskScore } from '../../types/riskScore';
import { useAuthUser } from '../auth/auth';
import { OFFICER_ROLES } from '../officer/officerAuth';
import { useHistoricalClusters } from '../officer/historicalImagery';
import HistoricalYearCompare from '../officer/HistoricalYearCompare';
import HistoricalMapView from '../officer/HistoricalMapView';
import { useTranslation } from '../../context/LanguageContext';
import DemoDataBadge from '../../components/DemoDataBadge';

type TabKey = 'overview' | 'landRecords' | 'registration' | 'planning' | 'tax' | 'restriction' | 'dispute' | 'encumbrance' | 'ownershipHistory';

// Owner-only tabs (parcels.controller.ts's getParcel360 withholds these same
// five departments server-side when restrictedForViewer is true; Ownership
// History is separately 401/403-gated by GET :id/ownership-history). Per
// the user's explicit "remove the options itself... it should not be able
// to see the details" - hidden entirely for a non-owner, not just shown
// with a "restricted" message.
const OWNER_ONLY_TAB_KEYS: TabKey[] = ['planning', 'tax', 'restriction', 'dispute', 'encumbrance', 'ownershipHistory'];

// Same Bauhaus status-badge treatment as TopRiskParcels.tsx (docs/design.md
// §7) - kept in sync there rather than shared, matching this codebase's
// usual per-component convention for small lookup tables like this.
const RISK_BAND_CLASS: Record<string, string> = {
  LOW: 'bg-muted text-ink border-ink',
  MEDIUM: 'bg-accent text-ink border-ink',
  HIGH: 'bg-secondary text-white border-ink',
  CRITICAL: 'bg-secondary-strong text-white border-ink',
};

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function NotAvailable({ department }: { department: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-40 items-center justify-center text-ink/50 text-sm">
      {t('parcel360.notAvailable', { department })}
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
  const { t, currentLang } = useTranslation();
  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: t('parcel360.tab.overview') },
    { key: 'landRecords', label: t('parcel360.tab.landRecords') },
    { key: 'registration', label: t('parcel360.tab.registration') },
    { key: 'planning', label: t('parcel360.tab.planning') },
    { key: 'tax', label: t('parcel360.tab.tax') },
    { key: 'restriction', label: t('parcel360.tab.restriction') },
    { key: 'dispute', label: t('parcel360.tab.dispute') },
    { key: 'encumbrance', label: t('parcel360.tab.encumbrance') },
    { key: 'ownershipHistory', label: t('parcel360.tab.ownershipHistory') },
  ];
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: authUser } = useAuthUser();
  const isOfficer = !!authUser && (OFFICER_ROLES as readonly string[]).includes(authUser.role);
  const isCitizen = authUser?.role === 'CITIZEN';
  const isStaffViewer = isOfficer || authUser?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [serviceRequest, setServiceRequest] = useState<{ workflowType: string; title: string } | null>(null);
  const [officialPdfUrl, setOfficialPdfUrl] = useState<string | null>(null);
  const [officialPdfError, setOfficialPdfError] = useState<string | null>(null);

  // "Locate" action, next to the map's own year toggle (per the user's
  // explicit placement). MapComponent only fits its view to the selected
  // parcel's context once, when that context first loads (React Query
  // caches it) - clicking Locate needs to re-trigger that fly-to/fit-bounds
  // on demand even though nothing about the selection has changed, hence
  // recenterSignal (bumped on every click, threaded through to MapComponent
  // either directly or via HistoricalMapView). Also scrolls the map section
  // into view in case the Overview tab's other content pushed it off-screen.
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const handleLocate = () => {
    setRecenterSignal((n) => n + 1);
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const closeOfficialPdf = () => {
    setOfficialPdfUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setOfficialPdfError(null);
  };

  const fetchOfficialPdf = async () => {
    setOfficialPdfError(null);
    const lang = currentLang === 'hi' ? 'hi' : 'en';
    try {
      const response = await apiService.get(`/parcels/${id}/documents/official-pdf`, {
        params: { lang },
        responseType: 'blob',
      });
      const contentType = String(response.headers['content-type'] ?? '');
      if (!contentType.includes('application/pdf')) {
        throw new Error('The server did not return a PDF document');
      }
      const nextUrl = URL.createObjectURL(response.data as Blob);
      setOfficialPdfUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
    } catch {
      setOfficialPdfError('Unable to generate the official document.');
    }
  };

  useEffect(() => () => closeOfficialPdf(), []);
  // The two-year comparison used to navigate to /officer/historical-imagery
  // (docs/ADMIN_PANEL_ISSUES.md follow-up, per the user's explicit "the
  // compare years data in the parcel 360 should also not redirect to
  // historical analysis, this analysis should be done there only in the
  // parcel 360") - now toggled inline instead, reusing HistoricalYearCompare
  // (extracted out of HistoricalImageryPanel.tsx for exactly this).
  const [showHistoricalCompare, setShowHistoricalCompare] = useState(false);

  const closeServiceRequest = () => {
    setServiceRequest(null);
  };

  const { data: parcel360, isLoading, error } = useQuery<Parcel360Response>(
    ['parcel-360', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}/360`);
      return response.data;
    },
    { enabled: !!id, keepPreviousData: true },
  );

  const explainMutation = useMutation<AiExplanation, Error>(async () => {
    const response = await apiService.post(`/ai/parcels/${id}/explain`);
    return response.data;
  });

  // On-demand official Record of Rights PDF (BACKLOG.md item 14) - built
  // fresh per request from real Parcel/OwnershipHistoryRecord rows, not a
  // stored file, so it's fetched as a blob and handed to the browser as a
  // download rather than linked directly (the route needs an auth header).
  const downloadPdfMutation = useMutation<void, Error>(async () => {
    const lang = currentLang === 'hi' ? 'hi' : 'en';
    const response = await apiService.get(`/parcels/${id}/documents/official-pdf`, {
      params: { lang },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `record-of-rights-${id}.pdf`;
    link.click();
    // Revoke on a short timeout to allow the browser to start the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    async () => (await apiService.get('/parcels/mine', { skipAuthRedirect: true })).data,
    { enabled: isCitizen },
  );
  const isOwnParcel = isCitizen && !!myParcelsData?.parcels.some((p) => p.id === parcel360?.parcel_id);

  // Risk score for a citizen's own parcel, or any parcel for staff
  // (docs/ADMIN_PANEL_ISSUES.md follow-up) - the same real weighted score
  // AdminDashboard's Top Risk Parcels list already surfaces to staff, now
  // also shown inline on Parcel 360 itself. Public endpoint, but only
  // fetched/shown here for an owner/staff viewer so a citizen browsing a
  // parcel that isn't theirs doesn't see someone else's risk detail.
  const canViewRiskScore = isOwnParcel || isStaffViewer;
  const { data: riskScore } = useQuery<RiskScore>(
    ['risk-score', id],
    async () => (await apiService.get(`/parcels/${id}/risk-score`)).data,
    { enabled: !!id && canViewRiskScore },
  );

  // Public (2026-09-08) - when the parcel belongs to a cluster, upgrades the
  // "Parcel Map" below into the year-dropdown/dispute-colored historical
  // view, for citizens as much as staff. Cheap/cached (5 clusters total), so
  // fetched unconditionally rather than gated on parcel360.clusterId being
  // known yet.
  const { data: historicalClusters = [] } = useHistoricalClusters();
  const historicalCluster = parcel360 ? historicalClusters.find((c) => c.clusterId === parcel360.clusterId) : undefined;

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
    closeOfficialPdf();
    explainMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return <div className="flex h-[600px] items-center justify-center text-ink/60 font-medium">{t('parcel360.loading')}</div>;
  }

  if (error) {
    return <div className="flex h-[600px] items-center justify-center text-secondary-strong font-medium">{t('parcel360.error')}</div>;
  }

  if (!parcel360) {
    return <div className="flex h-[600px] items-center justify-center text-ink/60 font-medium">{t('parcel360.notFound')}</div>;
  }

  const { identifiers, location, spatial, sources, departments, zoneMembership } = parcel360;
  const conflicts = parcel360.conflicts ?? [];
  const statusByDepartment = Object.fromEntries(sources.map((s) => [s.department, s.status]));
  const visibleTabs = parcel360.restrictedForViewer ? TABS.filter((tab) => !OWNER_ONLY_TAB_KEYS.includes(tab.key)) : TABS;

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

      {officialPdfUrl && (
        <OfficialPdfViewerModal
          url={officialPdfUrl}
          fileName={`record-of-rights-${id}.pdf`}
          onClose={closeOfficialPdf}
        />
      )}
      {officialPdfError && <p role="alert" className="text-secondary-strong text-sm px-2">{officialPdfError}</p>}

      {/* Actions moved to the top of the page (docs/ADMIN_PANEL_ISSUES.md
          follow-up, per the user's explicit "bring the actions tab on top"). */}
      <div className="bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">{t('parcel360.actions')}</h2>
        <div className="flex flex-wrap gap-3">
          {isOwnParcel && (
            <>
              <button
                onClick={() => setServiceRequest({ workflowType: 'ROR_COPY_REQUEST', title: t('parcel360.requestRorTitle') })}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                {t('parcel360.requestDocuments')}
              </button>
              <button
                onClick={() => setServiceRequest({ workflowType: 'CORRECTION_REQUEST', title: t('parcel360.reportIssueTitle') })}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                {t('parcel360.reportIssue')}
              </button>
              <button
                onClick={() => setServiceRequest({ workflowType: 'DISPUTE_FILING', title: t('parcel360.fileDisputeTitle') })}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <MessageSquareWarning className="w-3.5 h-3.5" aria-hidden="true" />
                {t('common.fileDispute')}
              </button>
              <button
                onClick={() => setServiceRequest({ workflowType: 'DOCUMENT_VERIFICATION_REQUEST', title: t('citizenNav.verifyDocuments') })}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                {t('citizenNav.verifyDocuments')}
              </button>
            </>
          )}
          {(isOwnParcel || isStaffViewer) && (
            <>
              <button
                onClick={() => fetchOfficialPdf().catch(() => setOfficialPdfError('Unable to generate the official document.'))}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                {t('parcel360.viewOfficialDocument')}
              </button>
              <button
                onClick={() => downloadPdfMutation.mutate()}
                disabled={downloadPdfMutation.isLoading}
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                {downloadPdfMutation.isLoading ? t('parcel360.downloadingOfficialDocument') : t('parcel360.downloadOfficialDocument')}
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
            {isCitizen ? t('parcel360.backToSearch') : t('common.back')}
          </button>
          {isOfficer && historicalCluster && (
            <button
              onClick={() => setShowHistoricalCompare((v) => !v)}
              aria-expanded={showHistoricalCompare}
              className="inline-flex items-center gap-2 border-2 border-ink bg-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-muted active:translate-x-[2px] active:translate-y-[2px]"
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              {showHistoricalCompare ? t('parcel360.hideCompareYears') : t('parcel360.compareYears')}
            </button>
          )}
          <button
            onClick={() => explainMutation.mutate()}
            disabled={explainMutation.isLoading}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-wider text-background shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {explainMutation.isLoading ? t('parcel360.askingAi') : t('parcel360.explainWithAi')}
          </button>
        </div>

        {showHistoricalCompare && historicalCluster && (
          <div className="mt-4 pt-4 border-t-2 border-ink/10">
            <h3 className="text-sm font-black uppercase tracking-widest text-ink/70 mb-3">{t('parcel360.compareYears')}</h3>
            <HistoricalYearCompare key={historicalCluster.clusterId} clusterId={historicalCluster.clusterId} years={historicalCluster.years} />
          </div>
        )}

        {explainMutation.isError && (
          <p className="text-sm font-medium text-secondary-strong mt-4">
            {axios.isAxiosError(explainMutation.error) && explainMutation.error.response?.status === 503
              ? t('askAiWidget.notConfigured')
              : t('parcel360.explainError')}
          </p>
        )}
        {explainMutation.isSuccess && (
          <div className="mt-4">
            <AiExplanationCard explanation={explainMutation.data} />
          </div>
        )}
      </div>

      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink" aria-hidden="true" />
        <h1 className="text-2xl font-black uppercase tracking-tight font-display text-ink mb-1">{t('parcel360.heading')}</h1>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <p className="text-sm text-ink/50 font-mono">{parcel360.parcel_id}</p>
          <DemoDataBadge />
        </div>

        <div className="border-b-2 border-ink/20 mb-4 overflow-x-auto">
          <nav className="-mb-px flex flex-wrap gap-1" aria-label={t('parcel360.sectionsAriaLabel')}>
            {visibleTabs.map((tab) => (
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
            {conflicts.length > 0 && (
              <div className="md:col-span-2 border-2 border-secondary-strong bg-secondary/5 p-4">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-secondary-strong mb-2">
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                  {t('parcel360.conflicts.heading')}
                </h2>
                <ul className="space-y-2">
                  {conflicts.map((c, i) => (
                    <li key={`${c.type}-${i}`} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${RISK_BAND_CLASS[c.severity] ?? 'bg-muted text-ink border-ink'}`}>
                        {t(`parcel360.conflicts.severity.${c.severity}`)}
                      </span>
                      <span className="text-ink/80">{c.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">{t('parcel360.identifiers')}</h2>
              <Field label={t('parcel360.field.ulpin')} value={identifiers.ulpin || t('common.notApplicable')} />
              <Field label={t('parcel360.field.surveyNumber')} value={identifiers.survey_number || t('common.notApplicable')} />
              <Field label={t('parcel360.field.plotNumber')} value={identifiers.plot_number || t('common.notApplicable')} />
              <Field label={t('parcel360.field.localIdentifier')} value={identifiers.local_identifier || t('common.notApplicable')} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">{t('parcel360.location')}</h2>
              <Field label={t('jurisdictionCard.state')} value={resolveStateName(location.state)} />
              <Field label={t('jurisdictionCard.district')} value={resolveDistrictName(location.district)} />
              <Field label={t('parcel360.field.locality')} value={location.locality} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">{t('parcel360.area')}</h2>
              <Field label={t('parcel360.area')} value={`${spatial.area_sq_m.toLocaleString()} m²`} />
            </div>
            {canViewRiskScore && riskScore && (() => {
              // Collapse the 4-tier backend band to the 3 categories the citizen
              // view shows (CRITICAL folds into HIGH); never surface the numeric
              // score - only the band + the plain-language factors behind it.
              const band = riskScore.riskBand === 'CRITICAL' ? 'HIGH' : riskScore.riskBand;
              const availableFactors = riskScore.factors.filter((f) => f.available);
              return (
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">{t('parcel360.riskScore')}</h2>
                <span
                  className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                    RISK_BAND_CLASS[band] ?? 'bg-muted text-ink border-ink'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  {t(`parcel360.riskBand.${band}`)}
                </span>
                {availableFactors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink/50">{t('parcel360.riskBasis')}</p>
                    {availableFactors.map((factor) => (
                      <p key={factor.key} className="text-xs text-ink/60">
                        <strong className="font-bold text-ink/80">{factor.label}:</strong> {factor.rationale}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              );
            })()}
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">{t('parcel360.dataSources')}</h2>
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

            <div ref={mapSectionRef} className="md:col-span-2 overflow-hidden">
              <h2 className="text-sm font-black uppercase tracking-widest text-secondary mb-2">{t('parcel360.parcelMap')}</h2>
              <p className="text-sm text-ink/60 mb-3 leading-relaxed">
                {t('parcel360.mapDesc')}
                {historicalCluster && ' ' + t('parcel360.mapDescHistorical')}
              </p>
              {historicalCluster ? (
                <HistoricalMapView
                  key={historicalCluster.clusterId}
                  clusterId={historicalCluster.clusterId}
                  years={historicalCluster.years}
                  selectedParcelId={parcel360.parcel_id}
                  onParcelClick={(clickedId) => {
                    if (clickedId !== parcel360.parcel_id) navigate(`/parcels/${clickedId}`);
                  }}
                  recenterSignal={recenterSignal}
                  showLayerButtonsBelowMap
                />
              ) : (
                <UnifiedMapWrapper
                  parcels={[{
                    id: parcel360.parcel_id,
                    canonicalParcelId: identifiers.ulpin,
                    ulpin: identifiers.ulpin,
                    stateCode: location.state,
                    districtCode: location.district,
                    localBodyCode: location.locality,
                    areaSqM: spatial.area_sq_m,
                    geometry: JSON.stringify(spatial.geometry),
                    legalStatusSeverity: (parcel360 as any).legal_status_severity ?? 0,
                  }]}
                  selectedParcelId={parcel360.parcel_id}
                  // Zoom straight to this parcel's own bounds so opening a
                  // 360 view lands on the parcel, not the all-India default.
                  fitToParcels
                  onParcelClick={(clickedId) => {
                    if (clickedId !== parcel360.parcel_id) navigate(`/parcels/${clickedId}`);
                  }}
                  recenterSignal={recenterSignal}
                  // Every role sees the full layer legend; adminNotes stays
                  // gated (admin-only server-side + filtered in UnifiedMapWrapper).
                  showLayerPanel
                  showLayerButtonsBelowMap
                  userRole={authUser?.role}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'landRecords' && (
          departments.landRecords ? (
            <div className="space-y-1">
              <Field label={t('parcel360.field.sourceSchema')} value={departments.landRecords.sourceSchema} />
              <Field label={t('parcel360.field.sourceIdentifier')} value={departments.landRecords.sourceIdentifier} />
              <Field label={t('parcel360.field.ownerName')} value={departments.landRecords.ownerName} />
              <Field label={t('parcel360.area')} value={`${departments.landRecords.areaSqM.toLocaleString()} m²`} />
              <Field label={t('parcel360.field.locality')} value={departments.landRecords.locality} />
            </div>
          ) : (
            <NotAvailable department={statusByDepartment.LAND_RECORDS ? t('parcel360.tab.landRecords') : t('parcel360.landRecordsNoIdentifier')} />
          )
        )}

        {activeTab === 'registration' && (
          departments.registration ? (
            <div className="space-y-1">
              <Field label={t('verificationCard.status')} value={departments.registration.registrationStatus} />
              <Field label={t('parcel360.field.registrationNumber')} value={departments.registration.registrationNumber || t('common.notApplicable')} />
              <Field label={t('parcel360.field.registrationDate')} value={formatDate(departments.registration.registrationDate)} />
              <Field label={t('parcel360.field.lastTransaction')} value={departments.registration.lastTransactionType || t('common.notApplicable')} />
              <Field label={t('parcel360.field.lastTransactionDate')} value={formatDate(departments.registration.lastTransactionDate)} />
            </div>
          ) : (
            <NotAvailable department={t('parcel360.tab.registration')} />
          )
        )}

        {activeTab === 'planning' && (
          departments.planning ? (
            <div className="space-y-1">
              <Field label={t('parcel360.field.landUse')} value={departments.planning.landUse} />
              <Field label={t('parcel360.field.zoningClassification')} value={departments.planning.zoningClassification} />
              {zoneMembership && (
                <Field
                  label={t('parcel360.field.zoneByOverlap')}
                  value={`${zoneMembership.name} (${zoneMembership.zoneType}) - ${zoneMembership.overlapPct.toFixed(1)}%`}
                />
              )}
              <Field label={t('parcel360.field.masterPlanReference')} value={departments.planning.masterPlanReference} />
              <Field label={t('parcel360.field.buildingPermission')} value={departments.planning.buildingPermissionStatus} />
            </div>
          ) : (
            <NotAvailable department={t('parcel360.tab.planning')} />
          )
        )}

        {activeTab === 'tax' && (
          departments.tax ? (
            <div className="space-y-1">
              <Field label={t('parcel360.field.assessedValue')} value={formatCurrency(departments.tax.assessedValue)} />
              <Field label={t('parcel360.field.annualTax')} value={formatCurrency(departments.tax.annualTaxAmount)} />
              <Field label={t('parcel360.field.taxStatus')} value={departments.tax.taxStatus} />
              <Field label={t('parcel360.field.outstandingAmount')} value={formatCurrency(departments.tax.outstandingAmount)} />
              <Field label={t('parcel360.field.lastPaymentDate')} value={formatDate(departments.tax.lastPaymentDate)} />
              <Field
                label={t('parcel360.field.marketValueReference')}
                value={departments.tax.marketValueReference !== null ? formatCurrency(departments.tax.marketValueReference) : t('common.notApplicable')}
              />
              <Field label={t('parcel360.field.valuationDate')} value={formatDate(departments.tax.valuationDate)} />
              <Field label={t('parcel360.field.valuationSource')} value={departments.tax.valuationSource || t('common.notApplicable')} />
            </div>
          ) : (
            <NotAvailable department={t('parcel360.tab.tax')} />
          )
        )}

        {activeTab === 'restriction' && (
          departments.restriction ? (
            <div className="space-y-1">
              <Field label={t('parcel360.field.hasRestriction')} value={departments.restriction.hasRestriction ? t('common.yes') : t('common.no')} />
              {departments.restriction.hasRestriction && (
                <>
                  <Field label={t('parcel360.field.restrictionType')} value={departments.restriction.restrictionType || t('common.notApplicable')} />
                  <Field label={t('parcel360.field.details')} value={departments.restriction.restrictionDetails || t('common.notApplicable')} />
                  <Field label={t('parcel360.field.imposingAuthority')} value={departments.restriction.imposingAuthority || t('common.notApplicable')} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department={t('parcel360.tab.restriction')} />
          )
        )}

        {activeTab === 'dispute' && (
          departments.dispute ? (
            <div className="space-y-1">
              <Field label={t('parcel360.field.hasActiveDispute')} value={departments.dispute.hasActiveDispute ? t('common.yes') : t('common.no')} />
              <Field label={t('parcel360.field.disputeType')} value={departments.dispute.disputeType || t('common.notApplicable')} />
              <Field label={t('parcel360.field.caseStatus')} value={departments.dispute.caseStatus || t('common.notApplicable')} />
              <Field label={t('parcel360.field.filingDate')} value={formatDate(departments.dispute.filingDate)} />
              {!departments.dispute.hasActiveDispute && departments.dispute.caseStatus && (
                <>
                  <Field label={t('parcel360.field.resolutionDate')} value={formatDate(departments.dispute.resolutionDate)} />
                  <Field label={t('parcel360.field.resolutionSummary')} value={departments.dispute.resolutionSummary || t('common.notApplicable')} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department={t('parcel360.tab.dispute')} />
          )
        )}

        {activeTab === 'encumbrance' && (
          departments.encumbrance ? (
            <div className="space-y-1">
              <Field label={t('parcel360.field.hasEncumbrance')} value={departments.encumbrance.hasEncumbrance ? t('common.yes') : t('common.no')} />
              {departments.encumbrance.hasEncumbrance && (
                <>
                  <Field label={t('parcel360.field.encumbranceType')} value={departments.encumbrance.encumbranceType || t('common.notApplicable')} />
                  <Field label={t('parcel360.field.lenderName')} value={departments.encumbrance.lenderName || t('common.notApplicable')} />
                  <Field label={t('parcel360.field.instrumentReference')} value={departments.encumbrance.instrumentReference || t('common.notApplicable')} />
                  <Field label={t('parcel360.field.registeredDate')} value={formatDate(departments.encumbrance.registeredDate)} />
                  <Field label={t('parcel360.field.dischargeDate')} value={formatDate(departments.encumbrance.dischargeDate)} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department={t('parcel360.tab.encumbrance')} />
          )
        )}

        {activeTab === 'ownershipHistory' && (
          <div>
            {ownershipHistoryLoading && <div className="text-ink/60 text-sm py-4">{t('parcel360.ownershipHistoryLoading')}</div>}
            {ownershipHistoryError && (
              <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">
                {axios.isAxiosError(ownershipHistoryError) && ownershipHistoryError.response?.status === 401
                  ? t('parcel360.ownershipHistory401')
                  : axios.isAxiosError(ownershipHistoryError) && ownershipHistoryError.response?.status === 403
                    ? t('parcel360.ownershipHistory403')
                    : t('parcel360.ownershipHistoryError')}
              </div>
            )}
            {ownershipHistory && ownershipHistory.length === 0 && (
              <div className="text-ink/60 text-sm border-2 border-dashed border-ink/30 px-4 py-6 text-center">
                {t('parcel360.ownershipHistoryEmpty')}
              </div>
            )}
            {ownershipHistory && ownershipHistory.length > 0 && (
              <div className="space-y-1 divide-y-2 divide-ink/10">
                {/* Backend orders oldest-first (transactionDate ASC), so the
                    last entry is the most recent transaction - the current
                    owner. */}
                {ownershipHistory.map((entry, index) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 text-sm py-2 first:pt-0 last:pb-0">
                    <div>
                      <span className="font-bold text-ink">{entry.ownerName}</span>
                      {index === ownershipHistory.length - 1 && (
                        <span className="ml-2 inline-block border-2 border-ink bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white align-middle">
                          {t('parcel360.currentOwner')}
                        </span>
                      )}
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
    </div>
  );
};

export default Parcel360View;
