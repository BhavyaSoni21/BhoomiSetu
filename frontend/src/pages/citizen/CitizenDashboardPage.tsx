import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Flag, MapPin, Inbox, Search, ShieldQuestion, Send, ListChecks } from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser } from '../../features/auth/auth';
import { ParcelSummary } from '../../types/parcel';
import { Workflow } from '../../types/workflow';
import LandClaimPanel from '../../features/citizen/LandClaimPanel';

// Summary only - the detailed data lives on its own dedicated page
// (docs/FRONTEND_UPGRADE_SPEC.md §4's "Dashboard: a summary only"). Reuses
// MyParcels.tsx's exact query key ('my-parcels') so navigating
// Dashboard -> My Parcels doesn't re-fetch what's already cached.
const CitizenDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  const [showLandClaim, setShowLandClaim] = useState(false);

  const { data: parcelsData } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
  );
  const { data: workflows = [] } = useQuery<Workflow[]>(
    ['my-workflows'],
    async () => (await apiService.get('/workflows/mine')).data,
  );
  const pendingCount = workflows.filter((w) => w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS').length;

  const quickLinks = [
    { to: '/citizen/find', Icon: Search, label: t('citizenNav.findParcels') },
    { to: '/citizen/raise-request', Icon: Send, label: t('citizenNav.raiseRequest') },
    { to: '/citizen/requests', Icon: ListChecks, label: t('citizenNav.requests') },
    { to: '/citizen/raise-request', Icon: ShieldQuestion, label: t('citizenNav.verifyDocuments') },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-display text-ink">
          {t('citizenPortal.dashboardWelcome', { name: user?.name ?? '' })}
        </h1>
        <p className="text-ink/60 mt-1">{t('citizenPortal.dashboardSubtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-surface border-2 border-ink shadow-hard-sm p-5">
          <div className="w-9 h-9 mb-3 flex items-center justify-center border-2 border-ink bg-primary/20 text-primary">
            <MapPin className="w-4 h-4" aria-hidden="true" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">
            {t('citizenPortal.dashboardParcelsLabel')}
          </h3>
          <p className="text-3xl font-black font-display text-ink">{parcelsData?.total ?? 0}</p>
        </div>
        <div className="bg-surface border-2 border-ink shadow-hard-sm p-5">
          <div className="w-9 h-9 mb-3 flex items-center justify-center border-2 border-ink bg-secondary/20 text-secondary">
            <Inbox className="w-4 h-4" aria-hidden="true" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink/60 mb-1">
            {t('citizenPortal.dashboardPendingLabel')}
          </h3>
          <p className="text-3xl font-black font-display text-ink">{pendingCount}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-ink/60 mb-3">
          {t('citizenPortal.dashboardQuickLinksHeading')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map(({ to, Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 bg-surface border-2 border-ink px-4 py-3.5 font-bold text-sm text-ink shadow-hard-sm transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-surface border-2 border-ink shadow-hard-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 shrink-0 flex items-center justify-center border-2 border-ink bg-secondary/20 text-secondary">
              <Flag className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-ink mb-1">{t('placeholders.landClaimTitle')}</h3>
              <p className="text-sm text-ink/60 max-w-xl">{t('placeholders.landClaimDesc')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowLandClaim((v) => !v)}
            className="shrink-0 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
          >
            {showLandClaim ? 'Hide' : 'Search & Claim'}
          </button>
        </div>
        {showLandClaim && (
          <div className="mt-4">
            <LandClaimPanel />
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenDashboardPage;
