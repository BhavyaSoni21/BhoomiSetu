import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Search, AlertTriangle, FileCheck2, Eye, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import BackButton from '../../components/BackButton';

interface DuplicateRegistration {
  id: string;
  parcelId: string;
  originalRegistration: {
    id: string;
    registrationNumber: string;
    date: string;
    registeredOwner: string;
  };
  conflictingRegistration: {
    id: string;
    registrationNumber: string;
    date: string;
    registeredOwner: string;
  };
  duplicateFlag: 'EXACT_MATCH' | 'OVERLAPPING_BOUNDARY' | 'SAME_OWNER_MULTIPLE' | 'SUSPECTED_FRAUD';
  flaggedAt: string;
  status: 'PENDING_REVIEW' | 'RESOLVED_MERGED' | 'RESOLVED_REJECTED' | 'ESCALATED';
  riskScore: number;
}

const DuplicateRegistryPage: React.FC = () => {
  const { t } = useTranslation();

  const { data: duplicates = [], isLoading } = useQuery<DuplicateRegistration[]>(
    ['duplicate-registrations'],
    async () => (await apiService.get('/registration/duplicate-registry')).data,
  );

  const getFlagLabel = (flag: DuplicateRegistration['duplicateFlag']) => {
    const labels: Record<DuplicateRegistration['duplicateFlag'], string> = {
      EXACT_MATCH: t('officerDashboard.duplicateFlagExactMatch'),
      OVERLAPPING_BOUNDARY: t('officerDashboard.duplicateFlagOverlappingBoundary'),
      SAME_OWNER_MULTIPLE: t('officerDashboard.duplicateFlagSameOwnerMultiple'),
      SUSPECTED_FRAUD: t('officerDashboard.duplicateFlagSuspectedFraud'),
    };
    return labels[flag] || flag;
  };

  const getFlagColor = (flag: DuplicateRegistration['duplicateFlag']) => {
    const colors: Record<DuplicateRegistration['duplicateFlag'], string> = {
      EXACT_MATCH: 'bg-red-100 text-red-800',
      OVERLAPPING_BOUNDARY: 'bg-amber-100 text-amber-800',
      SAME_OWNER_MULTIPLE: 'bg-blue-100 text-blue-800',
      SUSPECTED_FRAUD: 'bg-red-100 text-red-800 border border-red-300',
    };
    return colors[flag] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: DuplicateRegistration['status']) => {
    const colors: Record<DuplicateRegistration['status'], string> = {
      PENDING_REVIEW: 'bg-amber-100 text-amber-900',
      RESOLVED_MERGED: 'bg-green-100 text-green-800',
      RESOLVED_REJECTED: 'bg-blue-100 text-blue-800',
      ESCALATED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-700 bg-red-50';
    if (score >= 50) return 'text-amber-700 bg-amber-50';
    return 'text-green-700 bg-green-50';
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <AlertTriangle className="w-4 h-4 text-action-600" />
          <span>{t('officerDashboard.duplicateRegistryHeading')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.duplicateRegistry', 'Duplicate Registry')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('officerDashboard.duplicateRegistryDesc', 'Review system-flagged duplicate or conflicting registrations on the same survey number. Automatic duplicate-registration flagging per IGR integration.')}
        </p>
      </div>

      <div className="gov-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-brand-700" />
            {t('officerDashboard.flaggedDuplicatesHeading', 'Flagged Duplicates')} ({duplicates.length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder={t('officerDashboard.searchPlaceholder', 'Search by parcel ID, registration number...')}
              className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
        ) : duplicates.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
            <FileCheck2 className="w-8 h-8 mx-auto text-gov-success mb-2" />
            <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.duplicateRegistryEmpty')}</p>
            <p className="text-xs text-text-secondary mt-1">
              {t('officerDashboard.noDuplicatesFlaggedDesc', 'No duplicate registrations currently flagged by the system.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px]">
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColParcelId')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColDuplicateFlag')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColOriginalReg')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColConflictingReg')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColRiskScore')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColStatus')}</th>
                  <th className="pb-3 font-semibold">{t('officerDashboard.tableColFlaggedDate')}</th>
                  <th className="pb-3 font-semibold text-right">{t('officerDashboard.tableColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gov-border">
                {duplicates.map((dup) => (
                  <tr key={dup.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 font-mono font-medium text-text-heading">
                      {dup.parcelId.slice(0, 12)}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getFlagColor(dup.duplicateFlag)}`}>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {getFlagLabel(dup.duplicateFlag)}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-text-primary">
                      {dup.originalRegistration.registrationNumber}
                      <br />
                      <span className="text-[10px] text-text-secondary">{dup.originalRegistration.registeredOwner}</span>
                    </td>
                    <td className="py-3 font-mono text-text-primary">
                      {dup.conflictingRegistration.registrationNumber}
                      <br />
                      <span className="text-[10px] text-text-secondary">{dup.conflictingRegistration.registeredOwner}</span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${getRiskColor(dup.riskScore)}`}>
                        {dup.riskScore}/100
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getStatusColor(dup.status)}`}>
                        {t(`officerDashboard.status.${dup.status.toLowerCase()}`, dup.status.replace(/_/g, ' '))}
                      </span>
                    </td>
                    <td className="py-3 text-text-secondary font-mono">
                      {dup.flaggedAt ? new Date(dup.flaggedAt).toLocaleDateString() : '—'}
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

export default DuplicateRegistryPage;