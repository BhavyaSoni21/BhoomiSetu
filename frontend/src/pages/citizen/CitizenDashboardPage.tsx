import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser } from '../../features/auth/auth';
import { ParcelSummary } from '../../types/parcel';
import { Workflow } from '../../types/workflow';
import LandClaimPanel from '../../features/citizen/LandClaimPanel';

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

  const pendingCount = workflows.filter(
    (w) => w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS'
  ).length;

  const approvedCount = workflows.filter((w) => w.currentStatus === 'APPROVED').length;

  return (
    <div className="space-y-8 animate-fade-up">
      {/* ── Welcome Header Banner ── */}
      <div
        className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--brand-900) 0%, #154D3B 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 30px rgba(15, 61, 46, 0.12)',
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold"
                style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.4)' }}
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                CITIZEN PORTAL · SVAMITVA VERIFIED
              </span>
              <span className="text-white/40 text-xs hidden sm:inline">|</span>
              <span className="text-white/70 text-xs font-mono hidden sm:inline">
                ID: {user?.id?.slice(0, 8) ?? 'CITIZEN'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-heading font-bold text-white tracking-tight">
              Namaste, {user?.name || 'Citizen'}
            </h1>
            <p className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed">
              Welcome to your unified BhoomiSetu dashboard. Manage your agricultural and urban property records, track revenue department applications, and verify geospatial boundaries.
            </p>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Registered Parcels
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-900/10 text-brand-900">
              <MapPin className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {parcelsLoading ? '...' : parcelsData?.total ?? 0}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">Active Deeds</span>
          </div>
          <Link
            to="/citizen/parcels"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
          >
            View Land Holdings <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Pending Actions
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-action-500/15 text-action-700">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {workflowsLoading ? '...' : pendingCount}
            </span>
            <span className="text-xs font-mono text-action-700 font-semibold">Under Review</span>
          </div>
          <Link
            to="/citizen/requests"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-action-700 hover:text-action-600 transition"
          >
            Track In-flight <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Approved Applications
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-100 text-gov-success">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">
              {workflowsLoading ? '...' : approvedCount}
            </span>
            <span className="text-xs font-mono text-gov-success font-semibold">Certificates Issued</span>
          </div>
          <Link
            to="/citizen/requests"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition"
          >
            Download Orders <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="gov-card p-5 transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Department Feeds
            </span>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand-900/10 text-brand-900">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-heading font-bold text-text-heading">7 / 7</span>
            <span className="text-xs font-mono text-gov-success font-semibold">Synchronized</span>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
            Revenue, Forest, Survey, Tax
          </span>
        </div>
      </div>

      {/* ── Recent Applications Table & Active Claims ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Applications */}
        <div className="lg:col-span-2 gov-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-heading font-bold text-lg text-text-heading">
                Recent Applications & Workflows
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Track live status updates and assigned revenue officers
              </p>
            </div>
            <Link
              to="/citizen/requests"
              className="text-xs font-semibold text-brand-700 hover:underline inline-flex items-center gap-1"
            >
              View All ({workflows.length}) <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {workflowsLoading ? (
            <div className="py-12 text-center text-sm text-text-muted">Loading active workflows…</div>
          ) : workflows.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
              <Inbox className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="text-sm font-semibold text-text-heading">No requests filed yet</p>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                Need to file a mutation, dispute or NOC verification? Click below to start.
              </p>
              <Link
                to="/citizen/raise-request"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Submit First Request
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                    <th className="pb-3 font-semibold">Application No</th>
                    <th className="pb-3 font-semibold">Type</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Filed Date</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gov-border">
                  {workflows.slice(0, 5).map((w) => {
                    const isPending = w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS';
                    const isApproved = w.currentStatus === 'APPROVED';
                    return (
                      <tr key={w.id} className="hover:bg-surface-2/60 transition-colors">
                        <td className="py-3 font-mono font-medium text-text-heading">
                          #{w.id.slice(0, 8)}
                        </td>
                        <td className="py-3 font-medium text-text-primary">
                          {w.workflowType?.replace(/_/g, ' ')}
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
                          {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to="/citizen/requests"
                            className="text-brand-700 hover:text-brand-900 font-semibold underline underline-offset-2"
                          >
                            Details
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
                SVAMITVA Property Claim
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Have an ancestral property or village Abadi parcel not yet linked to your Aadhaar/phone? File a digital ownership claim for drone-survey verification.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-surface-2 border border-gov-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-heading">
                <ShieldCheck className="w-4 h-4 text-gov-success" />
                <span>Legal Validity</span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Claims are reviewed by the Taluka Tehsildar with 30-day public notice per Land Revenue Code.
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
              {showLandClaim ? 'Close Claim Assistant' : 'File a Land Claim'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Land Claim Panel */}
      {showLandClaim && (
        <div className="gov-card p-6 border-2 border-brand-700 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-lg text-text-heading">
              New Property Ownership Claim
            </h3>
            <button
              onClick={() => setShowLandClaim(false)}
              className="text-xs font-semibold text-text-muted hover:text-text-heading"
            >
              Cancel
            </button>
          </div>
          <LandClaimPanel onSubmitted={() => setShowLandClaim(false)} />
        </div>
      )}
    </div>
  );
};

export default CitizenDashboardPage;
