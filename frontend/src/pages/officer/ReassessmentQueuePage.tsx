import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Search, AlertTriangle, FileCheck2, Eye, ChevronRight, RefreshCw, Calculator } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import BackButton from '../../components/BackButton';

interface ReassessmentRequest {
  id: string;
  parcelId: string;
  mutationReference: string;
  reassessmentReason: 'MUTATION_APPROVED' | 'AREA_CHANGE' | 'OWNERSHIP_CHANGE' | 'LAND_USE_CHANGE' | 'MARKET_VALUE_REVISION' | 'COURT_ORDER';
  previousAssessment: number;
  proposedAssessment: number;
  differenceAmount: number;
  differencePercent: number;
  requestedAt: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'NEEDS_CLARIFICATION' | 'ESCALATED';
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
}

const ReassessmentQueuePage: React.FC = () => {
  const { t } = useTranslation();

  const { data: reassessments = [], isLoading } = useQuery<ReassessmentRequest[]>(
    ['reassessment-queue'],
    async () => (await apiService.get('/tax/reassessment-queue')).data,
  );

  const pendingCount = reassessments.filter(r => r.status === 'PENDING_REVIEW').length;
  const approvedCount = reassessments.filter(r => r.status === 'APPROVED').length;
  const needsClarificationCount = reassessments.filter(r => r.status === 'NEEDS_CLARIFICATION').length;

  const getReasonLabel = (reason: ReassessmentRequest['reassessmentReason']) => {
    const labels: Record<ReassessmentRequest['reassessmentReason'], string> = {
      MUTATION_APPROVED: t('officerDashboard.reasonMutationApproved'),
      AREA_CHANGE: t('officerDashboard.reasonAreaChange'),
      OWNERSHIP_CHANGE: t('officerDashboard.reasonOwnershipChange'),
      LAND_USE_CHANGE: t('officerDashboard.reasonLandUseChange'),
      MARKET_VALUE_REVISION: t('officerDashboard.reasonMarketValueRevision'),
      COURT_ORDER: t('officerDashboard.reasonCourtOrder'),
    };
    return labels[reason] || reason;
  };

  const getReasonColor = (reason: ReassessmentRequest['reassessmentReason']) => {
    const colors: Record<ReassessmentRequest['reassessmentReason'], string> = {
      MUTATION_APPROVED: 'bg-blue-100 text-blue-800',
      AREA_CHANGE: 'bg-green-100 text-green-800',
      OWNERSHIP_CHANGE: 'bg-purple-100 text-purple-800',
      LAND_USE_CHANGE: 'bg-amber-100 text-amber-800',
      MARKET_VALUE_REVISION: 'bg-indigo-100 text-indigo-800',
      COURT_ORDER: 'bg-red-100 text-red-800',
    };
    return colors[reason] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: ReassessmentRequest['status']) => {
    const colors: Record<ReassessmentRequest['status'], string> = {
      PENDING_REVIEW: 'bg-amber-100 text-amber-900',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      NEEDS_CLARIFICATION: 'bg-blue-100 text-blue-800',
      ESCALATED: 'bg-red-100 text-red-800 border border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <Calculator className="w-4 h-4 text-action-600" />
          <span>{t('officerDashboard.reassessmentQueueHeading')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.reassessmentQueue', 'Reassessment Queue')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('officerDashboard.reassessmentQueueDesc', 'Mutation-triggered reassessments auto-generated when Land Record Officer approves a mutation. Review and approve/reject proposed tax reassessments.')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="gov-card p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.pendingReviewLabel')}</span>
            <RefreshCw className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-amber-700">{pendingCount}</div>
        </div>
        <div className="gov-card p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.approvedLabel')}</span>
            <FileCheck2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-green-700">{approvedCount}</div>
        </div>
        <div className="gov-card p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.needsClarificationLabel')}</span>
            <AlertTriangle className="w-5 h-5 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-blue-700">{needsClarificationCount}</div>
        </div>
      </div>

      <div className="gov-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-brand-700" />
            {t('officerDashboard.pendingReassessmentsHeading', 'Pending Reassessments')} ({reassessments.length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder={t('officerDashboard.searchReassessmentPlaceholder', 'Search by parcel ID, mutation ref...')}
              className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
        ) : reassessments.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
            <FileCheck2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
            <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.reassessmentQueueEmpty')}</p>
            <p className="text-xs text-text-secondary mt-1">
              {t('officerDashboard.noReassessmentsDesc', 'No reassessment requests pending at this time.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColParcelId')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColMutationRef')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColReassessmentReason')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColPreviousAssessment')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColProposedAssessment')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColDifference')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColStatus')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColRequestedDate')}</th>
                  <th className="pb-3 font-semibold text-right">{t('officerDashboard.tableColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gov-border">
                {reassessments.map((req) => (
                  <tr key={req.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 font-mono font-medium text-text-heading">{req.parcelId.slice(0, 12)}</td>
                    <td className="py-3 font-mono text-text-primary">#{req.mutationReference.slice(0, 8)}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getReasonColor(req.reassessmentReason)}`}>
                        {getReasonLabel(req.reassessmentReason)}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-text-secondary">₹{Number(req.previousAssessment).toLocaleString()}</td>
                    <td className="py-3 font-mono font-medium text-brand-900">₹{Number(req.proposedAssessment).toLocaleString()}</td>
                    <td className="py-3">
                      <span className={`font-mono font-semibold ${req.differenceAmount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {req.differenceAmount >= 0 ? '+' : ''}₹{Number(Math.abs(req.differenceAmount)).toLocaleString()}
                        <span className="text-[10px] font-normal text-text-secondary ml-1">
                          ({req.differencePercent >= 0 ? '+' : ''}{req.differencePercent.toFixed(1)}%)
                        </span>
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getStatusColor(req.status)}`}>
                        {t(`officerDashboard.status.${req.status.toLowerCase()}`, req.status.replace(/_/g, ' '))}
                      </span>
                    </td>
                    <td className="py-3 text-text-secondary font-mono">
                      {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition">
                        {t('officerDashboard.reviewButton')} <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReassessmentQueuePage;