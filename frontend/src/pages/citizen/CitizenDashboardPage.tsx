import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../context/LanguageContext';
import DemoDataBadge from '../../components/DemoDataBadge';
import {
  MapPin,
  Inbox,
  ShieldCheck,
  FileCheck2,
  Clock,
  Flag,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  PlusCircle,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser } from '../../features/auth/auth';
import { ParcelSummary } from '../../types/parcel';
import { Workflow } from '../../types/workflow';
import { CaseOut } from '../../types/aiFlow';
import LandClaimPanel from '../../features/citizen/LandClaimPanel';
import SpeakerButton from '../../components/SpeakerButton';

const CitizenDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  const [showLandClaim, setShowLandClaim] = useState(false);

  const { data: parcelsData, isLoading: parcelsLoading } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<Workflow[]>(
    ['my-workflows'],
    async () => (await apiService.get('/workflows/mine')).data,
  );

  const { data: cases = [], isLoading: casesLoading } = useQuery<CaseOut[]>(
    ['my-cases'],
    async () => (await apiService.get('/cases/my')).data,
    { staleTime: 5 * 60 * 1000 },
  );

  // Workflow.currentStatus enum: SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | COMPLETED
  const pendingCount = workflows.filter(
    (w) => w.currentStatus === 'SUBMITTED' || w.currentStatus === 'UNDER_REVIEW'
  ).length;

  const approvedCount = workflows.filter(
    (w) => w.currentStatus === 'APPROVED' || w.currentStatus === 'COMPLETED'
  ).length;

  // Case.status enum: CREATED | ACTIVE | RESOLUTION | FEEDBACK | CLOSED
  const activeCaseCount = cases.filter((c) => c.status !== 'CLOSED').length;
  const actionRequiredCount = cases.filter((c) => c.status === 'FEEDBACK').length;
  const resolvedCaseCount = cases.filter((c) => c.status === 'CLOSED').length;

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex justify-end -mb-4"><DemoDataBadge /></div>
      {/* ── Welcome Header Banner ── */}
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 30px rgba(var(--color-ink), 0.12)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold"
                style={{ background: 'rgba(var(--action-500), 0.2)', color: 'var(--action-500)', border: '1px solid rgba(var(--action-500), 0.4)' }}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                {/* SVAMITVA is a government scheme name — intentionally not translated */}
                CITIZEN PORTAL · SVAMITVA VERIFIED
              </span>
              <span className="text-white/40 text-xs hidden sm:inline">|</span>
              <span className="text-white/70 text-xs font-mono hidden sm:inline">
                ID: {user?.id?.slice(0, 8) ?? 'CITIZEN'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-heading font-bold text-white tracking-tight">
              {t('citizenDashboard.greetingPrefix')}, {user?.name || t('citizenDashboard.defaultCitizenName')}
            </h1>
            <p className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed">
              {t('citizenDashboard.welcomeDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('citizenDashboard.registeredParcelsLabel')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-900/10 text-brand-900">
              <MapPin className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {parcelsLoading ? '...' : parcelsData?.total ?? 0}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">{t('citizenDashboard.activeDeedsLabel')}</span>
          </div>
          <Link
            to="/citizen/parcels"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
          >
            {t('citizenDashboard.viewLandHoldingsLink')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('citizenDashboard.activeCasesLabel', 'citizenNav.myCases')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-900/10 text-brand-900">
              <Inbox className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {casesLoading ? '...' : activeCaseCount}
            </span>
            <span className="text-xs font-mono text-action-700 font-semibold">{t('citizenDashboard.activeCasesSub', 'In Progress')}</span>
          </div>
          <Link
            to="/citizen/my-cases"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
          >
            {t('citizenDashboard.viewMyCasesLink', 'View my cases')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('citizenDashboard.actionRequiredLabel', 'Action Required')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-action-500/15 text-action-700">
              <Flag className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {casesLoading ? '...' : actionRequiredCount}
            </span>
            <span className="text-xs font-mono text-action-700 font-semibold">{t('citizenDashboard.needsAttention', 'Needs Attention')}</span>
          </div>
          <Link
            to="/citizen/my-cases"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-action-700 hover:text-action-600 transition"
          >
            {t('citizenDashboard.resolvePendingLink', 'Resolve pending')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('citizenDashboard.pendingActionsLabel')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-action-500/15 text-action-700">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {workflowsLoading ? '...' : pendingCount}
            </span>
            <span className="text-xs font-mono text-action-700 font-semibold">{t('citizenDashboard.underReviewLabel')}</span>
          </div>
          <Link
            to="/citizen/requests"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-action-700 hover:text-action-600 transition"
          >
            {t('citizenDashboard.trackInFlightLink')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('citizenDashboard.approvedApplicationsLabel')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100 text-gov-success">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {workflowsLoading ? '...' : approvedCount}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">{t('citizenDashboard.certificatesIssuedLabel')}</span>
          </div>
          <Link
            to="/citizen/requests"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
          >
            {t('citizenDashboard.downloadOrdersLink')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('citizenDashboard.resolvedCasesLabel', 'Resolved Cases')}
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100 text-gov-success">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {casesLoading ? '...' : resolvedCaseCount}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">{t('citizenDashboard.completedLabel', 'Completed')}</span>
          </div>
          <Link
            to="/citizen/my-cases"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
          >
            {t('citizenDashboard.viewMyCasesLink', 'View My Cases')} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Recent Applications Table & Active Claims ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Applications */}
        <div className="lg:col-span-2 gov-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-heading font-bold text-lg text-text-heading">
                {t('citizenDashboard.recentApplicationsHeading')}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {t('citizenDashboard.recentApplicationsDesc')}
              </p>
            </div>
            <Link
              to="/citizen/requests"
              className="text-xs font-semibold text-brand-700 hover:underline inline-flex items-center gap-1"
            >
              {t('citizenDashboard.viewAllLink')} ({workflows.length}) <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {workflowsLoading ? (
            <div className="py-12 text-center text-sm text-text-muted">{t('citizenDashboard.loadingWorkflows')}</div>
          ) : workflows.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
              <Inbox className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="text-sm font-semibold text-text-heading">{t('citizenDashboard.noRequestsYetHeading')}</p>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                {t('citizenDashboard.noRequestsYetDesc')}
              </p>
              <Link
                to="/citizen/raise-request"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" /> {t('citizenDashboard.submitFirstRequestButton')}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                    <th className="pb-3 font-semibold">{t('citizenDashboard.tableColAppNo')}</th>
                    <th className="pb-3 font-semibold">{t('citizenDashboard.tableColType')}</th>
                    <th className="pb-3 font-semibold">{t('citizenDashboard.tableColStatus')}</th>
                    <th className="pb-3 font-semibold">{t('citizenDashboard.tableColFiledDate')}</th>
                    <th className="pb-3 font-semibold text-right">{t('citizenDashboard.tableColAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gov-border">
                  {workflows.slice(0, 5).map((w) => {
                    const isPending = w.currentStatus === 'SUBMITTED' || w.currentStatus === 'UNDER_REVIEW';
                    const isApproved = w.currentStatus === 'APPROVED' || w.currentStatus === 'COMPLETED';
                    return (
                      <tr key={w.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-3 font-mono font-medium text-text-heading">
                          #{w.id.slice(0, 8)}
                        </td>
                        <td className="py-3 font-medium text-text-primary">
                          <div className="flex items-center gap-1.5">
                            <span>{w.workflowType?.replace(/_/g, ' ')}</span>
                            {w.workflowType && <SpeakerButton text={w.workflowType.replace(/_/g, ' ')} />}
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${
                              isApproved
                                ? 'bg-green-100 text-green-800'
                                : isPending
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {w.currentStatus}
                          </span>
                        </td>
                        <td className="py-3 text-text-secondary font-mono">
                          {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : t('citizenDashboard.recentFallback')}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to="/citizen/requests"
                            className="text-brand-700 hover:text-brand-900 font-semibold underline underline-offset-2"
                          >
                            {t('citizenDashboard.detailsLink')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Land Claim / SVAMITVA Advisory */}
        <div className="gov-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-action-700 mb-2">
              <Flag className="w-5 h-5 shrink-0" aria-hidden="true" />
              <h3 className="font-heading font-bold text-base text-text-heading">
                {/* SVAMITVA is an official government scheme name — intentionally not translated */}
                SVAMITVA Property Claim
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {t('citizenDashboard.landClaimDesc')}
            </p>

            <div className="mt-4 p-3 rounded-xl bg-surface-2 border border-gov-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-heading">
                <ShieldCheck className="w-4 h-4 text-gov-success" />
                <span>{t('citizenDashboard.legalValidityHeading')}</span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {t('citizenDashboard.legalValidityDesc')}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gov-border">
            <button
              type="button"
              onClick={() => setShowLandClaim((v) => !v)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-heading font-bold transition-all"
              style={{
                background: showLandClaim ? 'var(--surface-2)' : 'var(--brand-900)',
                color: showLandClaim ? 'var(--text-heading)' : '#FFFFFF',
                border: '1px solid var(--gov-border)',
              }}
            >
              {showLandClaim ? t('citizenDashboard.closeClaimAssistantButton') : t('citizenDashboard.fileALandClaimButton')}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Land Claim Panel */}
      {showLandClaim && (
        <div className="gov-card p-6 border-2 border-brand-700 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-lg text-text-heading">
              {t('citizenDashboard.newClaimHeading')}
            </h3>
            <button
              onClick={() => setShowLandClaim(false)}
              className="text-xs font-semibold text-text-muted hover:text-text-heading"
            >
              {t('citizenDashboard.cancelButton')}
            </button>
          </div>
          <LandClaimPanel onSubmitted={() => setShowLandClaim(false)} />
        </div>
      )}
    </div>
  );
};

export default CitizenDashboardPage;
