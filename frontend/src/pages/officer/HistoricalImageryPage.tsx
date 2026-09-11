import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { History, Layers, Calendar, Clock } from 'lucide-react';
import HistoricalImageryPanel from '../../features/officer/HistoricalImageryPanel';
import BackButton from '../../components/BackButton';

const HistoricalImageryPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const clusterId = searchParams.get('cluster');

  return (
    <div className="space-y-6 animate-fade-up max-w-7xl">
      <BackButton />
      <div className="pb-4 border-b border-gov-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-700 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <History className="w-4 h-4 text-action-600" />
            <span>Temporal Geospatial Audit · Satellite & Drone Archive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-heading">
            {t('officerNav.historicalImagery', 'Historical Imagery & Change Detection')}
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Side-by-side time-slider analysis comparing village cluster satellite snapshots over time to identify unauthorized land conversion.
          </p>
        </div>

        {clusterId && (
          <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-brand-900 text-white self-start sm:self-auto">
            Cluster: {clusterId}
          </span>
        )}
      </div>

      <div className="gov-card p-6">
        <HistoricalImageryPanel initialClusterId={clusterId} />
      </div>
    </div>
  );
};

export default HistoricalImageryPage;
