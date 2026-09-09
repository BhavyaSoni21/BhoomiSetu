import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { History } from 'lucide-react';
import HistoricalImageryPanel from '../../features/officer/HistoricalImageryPanel';

const sectionHeadingClass = 'text-xl sm:text-2xl font-black uppercase tracking-tight font-display text-ink mb-4 flex items-center gap-2';

// ?cluster=<id> lets Parcel360View deep-link straight into that parcel's
// cluster instead of landing on whichever cluster the panel defaults to.
const HistoricalImageryPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const clusterId = searchParams.get('cluster');

  return (
    <div className="bg-surface border-4 border-ink shadow-hard-lg p-4 sm:p-6">
      <h2 className={sectionHeadingClass}>
        <History className="w-5 h-5 text-secondary" aria-hidden="true" />
        Historical Imagery
      </h2>
      <HistoricalImageryPanel initialClusterId={clusterId} />
    </div>
  );
};

export default HistoricalImageryPage;
