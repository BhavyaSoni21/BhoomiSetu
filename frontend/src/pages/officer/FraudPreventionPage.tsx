import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import QueryError from '../../components/QueryError';
import { Search, AlertTriangle, ShieldAlert, Eye, ChevronRight, FileCheck2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import BackButton from '../../components/BackButton';

interface FraudRiskParcel {
  id: string;
  parcelId: string;
  ulpin: string;
  fraudRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  activeEncumbranceRequest: {
    id: string;
    requestType: 'MORTGAGE' | 'CHARGE' | 'LIEN' | 'LEASE';
    applicantName: string;
    amount: number;
    requestedAt: string;
  };
  disputeStatus: {
    hasActiveDispute: boolean;
    disputeType?: string;
    disputeId?: string;
    status?: string;
  };
  restrictionStatus: {
    hasActiveRestriction: boolean;
    restrictionType?: string;
    restrictionId?: string;
  };
  flaggedAt: string;
  flaggedBy: string;
}

const FraudPreventionPage: React.FC = () => {
  const { t } = useTranslation();

  const { data: fraudRisks = [], isLoading, isError, refetch } = useQuery<FraudRiskParcel[]>(
    ['fraud-prevention'],
    async () => (await apiService.get('/encumbrance/fraud-prevention')).data,
  );

  const criticalCount = fraudRisks.filter(f => f.fraudRiskLevel === 'CRITICAL').length;
  const highCount = fraudRisks.filter(f => f.fraudRiskLevel === 'HIGH').length;
  const mediumCount = fraudRisks.filter(f => f.fraudRiskLevel === 'MEDIUM').length;
  const preventedCount = fraudRisks.filter(f => f.disputeStatus.hasActiveDispute || f.restrictionStatus.hasActiveRestriction).length;

  const getRiskColor = (level: FraudRiskParcel['fraudRiskLevel']) => {
    const colors: Record<FraudRiskParcel['fraudRiskLevel'], string> = {
      CRITICAL: 'bg-red-100 text-red-800 border border-red-300',
      HIGH: 'bg-red-100 text-red-800',
      MEDIUM: 'bg-amber-100 text-amber-800',
      LOW: 'bg-blue-100 text-blue-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const getRequestTypeColor = (type: FraudRiskParcel['activeEncumbranceRequest']['requestType']) => {
    const colors: Record<FraudRiskParcel['activeEncumbranceRequest']['requestType'], string> = {
      MORTGAGE: 'bg-blue-100 text-blue-800',
      CHARGE: 'bg-purple-100 text-purple-800',
      LIEN: 'bg-red-100 text-red-800',
      LEASE: 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <ShieldAlert className="w-4 h-4 text-action-600" />
          <span>{t('officerDashboard.fraudPreventionHeading')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.fraudPrevention', 'Fraud Prevention')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('officerDashboard.fraudPreventionDesc', 'Cross-reference encumbrance requests with dispute/restriction records. Prevent mortgaging disputed/restricted land — core Encumbrance Officer workflow.')}
        </p>
      </div>

      {/* Risk Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="gov-card p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.criticalRiskLabel')}</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-red-700">{criticalCount}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.immediateActionRequiredLabel')}</p>
        </div>

        <div className="gov-card p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.highRiskLabel')}</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-amber-700">{highCount}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.reviewRequiredLabel')}</p>
        </div>

        <div className="gov-card p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.mediumRiskLabel')}</span>
            <ShieldAlert className="w-5 h-5 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-blue-700">{mediumCount}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.monitorLabel')}</p>
        </div>

        <div className="gov-card p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.fraudPreventedLabel')}</span>
            <FileCheck2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="mt-2 text-2xl font-heading font-bold text-green-700">{preventedCount}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.blockedByDisputeRestrictionLabel')}</p>
        </div>
      </div>

      <div className="gov-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-700" />
            {t('officerDashboard.flaggedParcelsHeading', 'Flagged Parcels')} ({fraudRisks.length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder={t('officerDashboard.searchFraudPlaceholder', 'Search by parcel ID, ULPI, applicant...')}
              className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : fraudRisks.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
            <FileCheck2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
            <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.noFraudRisks', 'No fraud risks detected')}</p>
            <p className="text-xs text-text-secondary mt-1">
              {t('officerDashboard.allClearDesc', 'No encumbrance requests conflict with active disputes or restrictions.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColParcelId')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColULPIN')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColFraudRisk')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColRequestType')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColApplicant')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColAmount')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColDisputeStatus')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColRestrictionStatus')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColFlaggedDate')}</th>
                  <th className="pb-3 font-semibold text-right">{t('officerDashboard.tableColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gov-border">
                {fraudRisks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 font-mono font-medium text-text-heading">{risk.parcelId.slice(0, 12)}</td>
                    <td className="py-3 font-mono text-text-secondary">{risk.ulpin.slice(0, 14)}...</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getRiskColor(risk.fraudRiskLevel)}`}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {risk.fraudRiskLevel} ({risk.riskScore})
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getRequestTypeColor(risk.activeEncumbranceRequest.requestType)}`}>
                        {risk.activeEncumbranceRequest.requestType}
                      </span>
                    </td>
                    <td className="py-3 text-text-primary">{risk.activeEncumbranceRequest.applicantName}</td>
                    <td className="py-3 font-mono text-text-secondary">₹{Number(risk.activeEncumbranceRequest.amount).toLocaleString()}</td>
                    <td className="py-3">
                      {risk.disputeStatus.hasActiveDispute ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-red-100 text-red-800">
                          <AlertCircle className="w-2.5 h-2.5" />
                          {t('officerDashboard.activeDisputeLabel')} ({risk.disputeStatus.disputeType})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-green-100 text-green-800">
                          <FileCheck2 className="w-2.5 h-2.5" />
                          {t('officerDashboard.noDisputeLabel')}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {risk.restrictionStatus.hasActiveRestriction ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {t('officerDashboard.activeRestrictionLabel')} ({risk.restrictionStatus.restrictionType})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-green-100 text-green-800">
                          <FileCheck2 className="w-2.5 h-2.5" />
                          {t('officerDashboard.noRestrictionLabel')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-text-secondary font-mono">
                      {risk.flaggedAt ? new Date(risk.flaggedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-900 hover:bg-brand-700 transition">
                        {t('officerDashboard.investigateButton')} <ChevronRight className="w-3 h-3" />
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

export default FraudPreventionPage;