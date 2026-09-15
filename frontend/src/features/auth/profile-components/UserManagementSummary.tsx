import React from 'react';
import { Users, ArrowRight, UserCheck, Clock, Key } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';

interface UserManagementSummaryProps {
  managedUsers?: number;
  activeOfficers?: number;
  pendingApprovals?: number;
  accessRequests?: number;
  onOpenUserManagement?: () => void;
  onOpenAccessManagement?: () => void;
}

export const UserManagementSummary: React.FC<UserManagementSummaryProps> = ({
  managedUsers = 184,
  activeOfficers = 32,
  pendingApprovals = 7,
  accessRequests = 12,
  onOpenUserManagement,
  onOpenAccessManagement,
}) => {
  return (
    <ProfileCard
      icon={<Users className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />}
      title="USER & ACCESS MANAGEMENT"
    >
      <div className="space-y-4">
        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pb-2">
          <div className="bg-white dark:bg-surface-2/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs">
            <div className="text-xl font-black font-heading text-text-heading">{managedUsers}</div>
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mt-0.5">Managed Users</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-emerald-700 dark:text-emerald-400">{activeOfficers}</div>
            <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mt-0.5">Active Officers</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-amber-700 dark:text-amber-400">{pendingApprovals}</div>
            <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider mt-0.5">Pending Approvals</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl">
            <div className="text-xl font-black font-heading text-blue-700 dark:text-blue-400">{accessRequests}</div>
            <div className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider mt-0.5">Access Requests</div>
          </div>
        </div>

        {/* Action Links */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/60 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
          <Link
            to="/admin/officers"
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            <span>Open User Management</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
          <Link
            to="/admin/workflows"
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            <span>Open Access Management</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </ProfileCard>
  );
};

export default UserManagementSummary;