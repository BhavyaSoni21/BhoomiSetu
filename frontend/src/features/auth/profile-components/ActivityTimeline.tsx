import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';

interface ActivityItem {
  id: string;
  action: string;
  timestamp: string;
  status: 'Completed' | 'Successful' | 'Failed';
}

export const ActivityTimeline: React.FC = () => {
  const activities: ActivityItem[] = [
    { id: '1', action: 'Signed in from Pune office', timestamp: '11 Sep 2026, 10:24 AM', status: 'Successful' },
    { id: '2', action: 'Verified an ownership request', timestamp: '10 Sep 2026, 04:18 PM', status: 'Completed' },
    { id: '3', action: 'Reviewed a cadastral parcel', timestamp: '10 Sep 2026, 02:32 PM', status: 'Completed' },
    { id: '4', action: 'Downloaded land-record report', timestamp: '09 Sep 2026, 05:46 PM', status: 'Completed' },
  ];

  return (
    <ProfileCard
      icon={<Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="RECENT ACTIVITY"
    >
      <div className="space-y-3">
        {activities.map((item) => (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800/60 last:border-none"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text-heading leading-tight">{item.action}</p>
              <span className="text-[11px] font-mono text-text-muted mt-0.5 block">{item.timestamp}</span>
            </div>
            <StatusPill status={item.status.toLowerCase()} label={item.status} size="sm" />
          </div>
        ))}

        <div className="pt-2 text-right">
          <Link
            to="/officer/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <span>View Full Activity Log</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default ActivityTimeline;