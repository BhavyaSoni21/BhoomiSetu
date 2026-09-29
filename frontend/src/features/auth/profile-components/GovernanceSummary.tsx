import React from 'react';
import { Sliders, ArrowRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';

interface GovernanceSummaryProps {
  activeConfigs?: number;
  pendingChanges?: number;
  districtsManaged?: number;
  statesManaged?: number;
}

export const GovernanceSummary: React.FC<GovernanceSummaryProps> = ({
  activeConfigs,
  pendingChanges,
  districtsManaged,
  statesManaged,
}) => {
  // Honest empty state ('-') for counters without a real backend source.
  const n = (v?: number) => (v == null ? '-' : v);
  return (
    <ProfileCard
      icon={<Sliders className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="GOVERNANCE / SYSTEM SUMMARY"
    >
      <div className="space-y-4">
        {/* Live counters - real values where an endpoint exists, '-' otherwise */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pb-2">
          <div className="bg-surface-2 dark:bg-surface-2/60 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-text-heading">{n(activeConfigs)}</div>
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-0.5">Active Configs</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-amber-700 dark:text-amber-400">{n(pendingChanges)}</div>
            <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-0.5">Pending Changes</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-emerald-700 dark:text-emerald-400">{n(districtsManaged)}</div>
            <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mt-0.5">Districts Managed</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-blue-700 dark:text-blue-400">{n(statesManaged)}</div>
            <div className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mt-0.5">State</div>
          </div>
        </div>

        {/* Action Link */}
        <div className="pt-1 text-right">
          <Link
            to="/admin/departments"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
          >
            <span>Open Governance</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default GovernanceSummary;