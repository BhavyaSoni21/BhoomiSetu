import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Search, TrendingUp, DollarSign, AlertTriangle, FileCheck2, Download, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import BackButton from '../../components/BackButton';

interface TaxAnalyticsData {
  collectionRate: number;
  totalDemand: number;
  totalCollected: number;
  totalOverdue: number;
  overdueTrend: { month: string; overdue: number }[];
  collectionByCategory: { category: string; collected: number; demand: number }[];
  topOverdueParcels: { parcelId: string; owner: string; overdueAmount: number; yearsOverdue: number }[];
  reassessmentStats: { pending: number; approved: number; rejected: number; totalValue: number };
}

const TaxAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();

  const { data: analytics, isLoading } = useQuery<TaxAnalyticsData>(
    ['tax-analytics'],
    async () => (await apiService.get('/tax/analytics')).data,
  );

  if (!analytics) return null;

  const formatCurrency = (amount: number) => `₹${Number(amount).toLocaleString('en-IN')}`;
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <BarChart3 className="w-4 h-4 text-action-600" />
          <span>{t('officerDashboard.taxAnalyticsHeading')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.taxAnalytics', 'Tax Analytics')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('officerDashboard.taxAnalyticsDesc', 'Collection rates, overdue trends, demand vs. collected — Revenue/Municipal tax department oversight dashboard.')}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="gov-card p-5 border-l-4 border-brand-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.collectionRateLabel')}</span>
            <TrendingUp className="w-5 h-5 text-brand-700" />
          </div>
          <div className="mt-2 text-3xl font-heading font-bold text-brand-900">{formatPercent(analytics.collectionRate)}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.ofTotalDemandLabel')}</p>
        </div>

        <div className="gov-card p-5 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.totalCollectedLabel')}</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="mt-2 text-3xl font-heading font-bold text-green-700">{formatCurrency(analytics.totalCollected)}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.thisFinancialYearLabel')}</p>
        </div>

        <div className="gov-card p-5 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.totalOverdueLabel')}</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-3xl font-heading font-bold text-amber-700">{formatCurrency(analytics.totalOverdue)}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.outstandingArrearsLabel')}</p>
        </div>

        <div className="gov-card p-5 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t('officerDashboard.reassessmentsPendingLabel')}</span>
            <FileCheck2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-heading font-bold text-blue-700">{analytics.reassessmentStats.pending}</div>
          <p className="text-xs text-text-secondary mt-1">{t('officerDashboard.awaitingReviewLabel')}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Collection Rate Trend */}
        <div className="gov-card p-6">
          <h3 className="font-heading font-bold text-lg text-text-heading mb-5 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-700" />
            {t('officerDashboard.collectionTrendHeading', 'Collection Trend (12 Months)')}
          </h3>
          <div className="h-64">
            {/* Simple bar chart using divs */}
            <div className="h-full flex items-end justify-around gap-2 px-2">
              {analytics.overdueTrend.map((item, index) => (
                <div key={index} className="flex flex-col items-center flex-1 h-full">
                  <div
                    className="w-full bg-amber-500 rounded-t transition-all hover:bg-amber-600"
                    style={{ height: `${Math.max(20, (item.overdue / Math.max(...analytics.overdueTrend.map(t => t.overdue))) * 200)}px` }}
                    title={`${item.month}: ${formatCurrency(item.overdue)}`}
                  />
                  <span className="text-[10px] font-mono text-text-muted mt-2">{item.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Collection by Category */}
        <div className="gov-card p-6">
          <h3 className="font-heading font-bold text-lg text-text-heading mb-5 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            {t('officerDashboard.collectionByCategoryHeading', 'Collection by Category')}
          </h3>
          <div className="space-y-4">
            {analytics.collectionByCategory.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-text-heading">{cat.category.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-brand-900">
                    {formatCurrency(cat.collected)} / {formatCurrency(cat.demand)}
                  </span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${cat.demand > 0 ? (cat.collected / cat.demand) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-right text-[10px] font-mono text-text-secondary">
                  {cat.demand > 0 ? formatPercent((cat.collected / cat.demand) * 100) : '0%'} {t('officerDashboard.collectedLabel')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Overdue Parcels */}
        <div className="gov-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              {t('officerDashboard.topOverdueParcelsHeading', 'Top Overdue Parcels')}
            </h3>
            <button className="text-xs font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1">
              {t('officerDashboard.viewAllLink')} <Download className="w-3 h-3" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
          ) : analytics.topOverdueParcels.length === 0 ? (
            <div className="py-8 text-center rounded-xl bg-surface-2 border border-gov-border">
              <FileCheck2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
              <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.noOverdueParcels', 'No overdue parcels')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                    <th className="pb-3 font-semibold">{t('officerDashboard.tableColParcelId')}</th>
                    <th className="pb-3 font-semibold">{t('officerDashboard.tableColOwner')}</th>
                    <th className="pb-3 font-semibold">{t('officerDashboard.tableColOverdueAmount')}</th>
                    <th className="pb-3 font-semibold">{t('officerDashboard.tableColYearsOverdue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gov-border">
                  {analytics.topOverdueParcels.slice(0, 10).map((parcel, index) => (
                    <tr key={parcel.parcelId} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-3 font-mono font-medium text-text-heading">{parcel.parcelId.slice(0, 12)}</td>
                      <td className="py-3 text-text-primary">{parcel.owner}</td>
                      <td className="py-3 font-mono font-semibold text-gov-error">{formatCurrency(parcel.overdueAmount)}</td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${parcel.yearsOverdue >= 3 ? 'bg-red-100 text-red-800' : parcel.yearsOverdue >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {parcel.yearsOverdue} {t('officerDashboard.yearsLabel')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Reassessment Summary */}
        <div className="gov-card p-6">
          <h3 className="font-heading font-bold text-lg text-text-heading mb-5 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" />
            {t('officerDashboard.reassessmentSummaryHeading', 'Reassessment Summary')}
          </h3>

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
              <span className="text-sm font-medium text-green-800">{t('officerDashboard.reassessmentsApprovedLabel')}</span>
              <span className="text-xl font-heading font-bold text-green-700">{analytics.reassessmentStats.approved}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
              <span className="text-sm font-medium text-red-800">{t('officerDashboard.reassessmentsRejectedLabel')}</span>
              <span className="text-xl font-heading font-bold text-red-700">{analytics.reassessmentStats.rejected}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
              <span className="text-sm font-medium text-amber-800">{t('officerDashboard.reassessmentsPendingLabel')}</span>
              <span className="text-xl font-heading font-bold text-amber-700">{analytics.reassessmentStats.pending}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50 border border-brand-100 border-t-2 border-brand-500">
              <span className="text-sm font-semibold text-brand-900">{t('officerDashboard.totalReassessmentValueLabel')}</span>
              <span className="text-xl font-heading font-bold text-brand-900">{formatCurrency(analytics.reassessmentStats.totalValue)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gov-border">
            <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white bg-brand-900 hover:bg-brand-700 transition">
              <Download className="w-4 h-4" />
              {t('officerDashboard.exportReportButton', 'Export Full Report')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxAnalyticsPage;