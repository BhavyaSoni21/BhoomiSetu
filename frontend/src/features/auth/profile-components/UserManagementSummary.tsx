import React from 'react';
import { Users, ShieldCheck, ExternalLink } from 'lucide-react';
import { useAuthUser } from '../auth';

interface UserManagementSummaryProps {
  onViewClick?: () => void;
}

const UserManagementSummary: React.FC<UserManagementSummaryProps> = ({ onViewClick }) => {
  const { data: user } = useAuthUser();

  const managedUsers = user?.role === 'ADMIN' ? 184 : undefined;
  const pendingApprovals = 23;
  const accessRequests = 15;
  const roleChanges = 8;

  return (
    <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
      <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">Managed Users</h3>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 gap-4">
        <div className="bg-surface/50 border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-ink">{managedUsers ?? '—'}</p>
              <p className="text-xs text-ink/50 font-bold uppercase tracking-wider">Managed Users</p>
            </div>
          </div>
        </div>
        <div className="bg-surface/50 border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 text-secondary-strong border-accent/40 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-ink">{pendingApprovals ?? '—'}</p>
              <p className="text-xs text-ink/50 font-bold uppercase tracking-wider">Pending Approvals</p>
            </div>
          </div>
        </div>
        <div className="bg-surface/50 border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary border-primary/50 flex items-center justify-center">
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-ink">{accessRequests ?? '—'}</p>
              <p className="text-xs text-ink/50 font-bold uppercase tracking-wider">Access Requests</p>
            </div>
          </div>
        </div>
        <div className="bg-surface/50 border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary border-primary/50 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-ink">{roleChanges ?? '—'}</p>
              <p className="text-xs text-ink/50 font-bold uppercase tracking-wider">Role Changes</p>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 border-t border-ink/20">
        <button
          type="button"
          onClick={onViewClick}
          className="w-full inline-flex items-center justify-center gap-2 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          Open User Management
        </button>
      </div>
    </div>
  );
};

export default UserManagementSummary;