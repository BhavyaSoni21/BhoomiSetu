import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';

export const AdminActivitySummary: React.FC = () => {
  const adminEvents = [
    { id: '1', action: 'Approved officer access', timestamp: '11 Sep 2026, 09:16 AM' },
    { id: '2', action: 'Updated role permissions', timestamp: '10 Sep 2026, 03:42 PM' },
    { id: '3', action: 'Added new officer account', timestamp: '09 Sep 2026, 11:20 AM' },
    { id: '4', action: 'Updated GIS configuration', timestamp: '08 Sep 2026, 05:14 PM' },
  ];

  return (
    <ProfileCard
      icon={<Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="RECENT ADMINISTRATIVE ACTIVITY"
    >
      <div className="space-y-3">
        {adminEvents.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800/60 last:border-none"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text-heading">{item.action}</p>
              <span className="text-[11px] font-mono text-text-muted">{item.timestamp}</span>
            </div>
          </div>
        ))}

        <div className="pt-2 text-right">
          <Link
            to="/admin/monitoring"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <span>View Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default AdminActivitySummary;