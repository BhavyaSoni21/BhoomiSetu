import React from 'react';
import { FileText, ArrowRight, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';
import { StatusPill } from './StatusPill';

interface DocumentsSummaryCardProps {
  verifiedCount?: number;
  pendingCount?: number;
  rejectedCount?: number;
  latestDocName?: string;
  onViewDocuments?: () => void;
}

export const DocumentsSummaryCard: React.FC<DocumentsSummaryCardProps> = ({
  verifiedCount = 5,
  pendingCount = 1,
  rejectedCount = 0,
  latestDocName = 'Sale Deed (2021)',
  onViewDocuments,
}) => {
  return (
    <ProfileCard
      icon={<FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="DOCUMENTS"
    >
      <div className="space-y-4">
        {/* Live Counters */}
        <div className="grid grid-cols-3 gap-2 text-center pb-3 border-b border-gray-100 dark:border-gray-800/60">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-emerald-700 dark:text-emerald-400">{verifiedCount}{'​'}</div>
            <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mt-0.5">Verified Docs</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-amber-700 dark:text-amber-400">{pendingCount}{'​'}</div>
            <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-0.5">Pending</div>
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-rose-700 dark:text-rose-400">{rejectedCount}{'​'}</div>
            <div className="text-[10px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider mt-0.5">Rejected</div>
          </div>
        </div>

        {/* Latest Document Card */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-surface-2/60 border border-[var(--border)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-text-muted">Latest document</span>
              <p className="text-xs font-bold text-text-heading truncate">{latestDocName}</p>
            </div>
          </div>
          <StatusPill status="registered" size="sm" />
        </div>

        {/* Action Link */}
        <div className="pt-1 text-right">
          {onViewDocuments ? (
            <button
              type="button"
              onClick={onViewDocuments}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              <span>View Documents</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ) : (
            <Link
              to="/citizen/profile?tab=documents"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 hover:underline"
            >
              <span>View Documents</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </ProfileCard>
  );
};

export default DocumentsSummaryCard;
