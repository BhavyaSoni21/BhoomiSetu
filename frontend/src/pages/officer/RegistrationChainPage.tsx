import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { Search, FileText, ChevronRight, Clock, ArrowUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import BackButton from '../../components/BackButton';
import { humanizeEnum, statusLabel } from '../../utils/statusLabel';

interface RegistrationChainEntry {
  id: string;
  parcelId: string;
  chainStep: number;
  registrationNumber: string;
  registrationDate: string;
  transactionType: 'SALE' | 'GIFT' | 'INHERITANCE' | 'PARTITION' | 'LEASE' | 'MORTGAGE' | 'RELEASE' | 'COURT_ORDER';
  previousOwner: string;
  newOwner: string;
  considerationAmount?: number;
  documentReference: string;
  registrationStatus: 'REGISTERED' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  linkedMutationId?: string;
  registeredBy: string;
}

const RegistrationChainPage: React.FC = () => {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState('');
  // Debounce so each keystroke doesn't fire a request.
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError } = useQuery<{ records: RegistrationChainEntry[]; total: number }>(
    ['registration-chain', debounced],
    async () => (await apiService.get('/registration/chain', { params: debounced ? { q: debounced } : {} })).data,
  );
  const chainEntries = data?.records ?? [];

  const getTransactionTypeColor = (type: RegistrationChainEntry['transactionType']) => {
    const colors: Record<RegistrationChainEntry['transactionType'], string> = {
      SALE: 'bg-blue-100 text-blue-800',
      GIFT: 'bg-purple-100 text-purple-800',
      INHERITANCE: 'bg-green-100 text-green-800',
      PARTITION: 'bg-amber-100 text-amber-800',
      LEASE: 'bg-cyan-100 text-cyan-800',
      MORTGAGE: 'bg-red-100 text-red-800',
      RELEASE: 'bg-indigo-100 text-indigo-800',
      COURT_ORDER: 'bg-red-100 text-red-800 border border-red-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: RegistrationChainEntry['registrationStatus']) => {
    const colors: Record<RegistrationChainEntry['registrationStatus'], string> = {
      REGISTERED: 'bg-green-100 text-green-800',
      PENDING: 'bg-amber-100 text-amber-900',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const groupedByParcel = chainEntries.reduce((acc, entry) => {
    if (!acc[entry.parcelId]) acc[entry.parcelId] = [];
    acc[entry.parcelId].push(entry);
    return acc;
  }, {} as Record<string, RegistrationChainEntry[]>);

  Object.values(groupedByParcel).forEach(entries => {
    entries.sort((a, b) => a.chainStep - b.chainStep);
  });

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
          <FileText className="w-4 h-4 text-action-600" />
          <span>{t('officerDashboard.registrationChainHeading')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
          {t('officerNav.registrationChain', 'Registration Chain')}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          {t('officerDashboard.registrationChainDesc', 'Full registration history per parcel. Supports linking registered documents to the RoR update chain per IGR workflow.')}
        </p>
      </div>

      <div className="gov-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-heading font-bold text-lg text-text-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-700" />
            {t('officerDashboard.parcelsWithHistoryHeading', 'Parcels with Registration History')} ({Object.keys(groupedByParcel).length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('officerDashboard.searchParcelPlaceholder', 'Search by parcel ID...')}
              className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl border border-gov-border bg-surface-1 text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-text-muted">{t('officerDashboard.loadingPendingQueue')}</div>
        ) : isError ? (
          <div className="py-10 text-center rounded-xl bg-danger-50 border border-danger-200">
            <p className="text-sm font-semibold text-danger-700">{t('common.loadError', 'Could not load registration chain. Please try again.')}</p>
          </div>
        ) : Object.keys(groupedByParcel).length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-surface-2 border border-gov-border">
            <FileText className="w-8 h-8 mx-auto text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-heading">{t('officerDashboard.noRegistrationHistory', 'No registration history found')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByParcel).map(([parcelId, entries]) => (
              <div key={parcelId} className="border border-gov-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 bg-surface-2 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-text-heading flex items-center gap-2">
                      <span className="font-mono text-ink">Parcel: {parcelId.slice(0, 12)}</span>
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">{entries.length} {t('officerDashboard.chainEntriesLabel', 'chain entries')}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-brand-900/10 text-brand-900">
                    {t('officerDashboard.latestStepLabel', 'Latest Step')} {Math.max(...entries.map(e => e.chainStep))}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gov-border text-text-muted uppercase font-mono text-[11px] bg-surface-1">
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColChainStep')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColRegNumber')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColRegDate')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColTransactionType')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColPreviousOwner')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColNewOwner')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColConsideration')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColDocumentRef')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColStatus')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColMutationRef')}</th>
                        <th className="pb-3 px-4 font-semibold">{t('officerDashboard.tableColRegisteredBy')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gov-border">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-ink">#{entry.chainStep}</td>
                          <td className="py-3 px-4 font-mono text-text-primary">{entry.registrationNumber}</td>
                          <td className="py-3 px-4 text-text-secondary font-mono">
                            {entry.registrationDate ? new Date(entry.registrationDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getTransactionTypeColor(entry.transactionType)}`}>
                              {humanizeEnum(entry.transactionType)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-text-primary">{entry.previousOwner}</td>
                          <td className="py-3 px-4 font-medium text-text-heading">{entry.newOwner}</td>
                          <td className="py-3 px-4 font-mono text-text-secondary">
                            {entry.considerationAmount ? `₹${Number(entry.considerationAmount).toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3 px-4 font-mono text-text-secondary">{entry.documentReference}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold ${getStatusColor(entry.registrationStatus)}`}>
                              {statusLabel(t, entry.registrationStatus)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-text-secondary">
                            {entry.linkedMutationId ? `#${entry.linkedMutationId.slice(0, 8)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-text-secondary">{entry.registeredBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationChainPage;