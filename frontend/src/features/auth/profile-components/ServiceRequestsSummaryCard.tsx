import React from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';

interface ServiceRequestsSummaryCardProps {
  totalRequests?: number;
  pendingRequests?: number;
  completedRequests?: number;
  rejectedRequests?: number;
}

export const ServiceRequestsSummaryCard: React.FC<ServiceRequestsSummaryCardProps> = ({
  totalRequests = 1,
  pendingRequests = 0,
  completedRequests = 1,
  rejectedRequests = 0,
}) => {
  return (
    <ProfileCard
      icon={<ClipboardList className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="SERVICE REQUESTS SUMMARY"
    >
      <div className="space-y-4">
        {/* Live Counters */}
        <div className="grid grid-cols-4 gap-2 text-center pb-2">
          <div className="bg-white dark:bg-surface-2/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs">
            <div className="text-xl font-black font-heading text-text-heading">{totalRequests}{'​'}</div>
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-0.5">All Requests</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-amber-700 dark:text-amber-400">{pendingRequests}{'​'}</div>
            <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-0.5">Pending</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-emerald-700 dark:text-emerald-400">{completedRequests}{'​'}</div>
            <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mt-0.5">Completed</div>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-rose-700 dark:text-rose-400">{rejectedRequests}{'​'}</div>
            <div className="text-[10px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider mt-0.5">Rejected</div>
          </div>
        </div>

        {/* Action Link */}
        <div className="pt-1 text-right">
          <Link
            to="/citizen/requests"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <span>View My Requests</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default ServiceRequestsSummaryCard;
