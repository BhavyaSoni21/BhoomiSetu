import React from 'react';
import { UserCircle2 } from 'lucide-react';
import { useAuthUser } from '../../features/auth/auth';
import { OfficerRole, ROLE_DEPARTMENT, ROLE_LABELS } from '../../features/officer/officerAuth';

// Officer's own account info (docs/FRONTEND_UPGRADE_SPEC.md §5) - not the
// mobile/email OTP flow, that's citizen-only (§3). Officer/admin accounts
// are admin-created (docs/flow.md rule 5), so there's nothing to "add or
// change" here yet beyond what the signed-in session already carries.
const OfficerProfilePage: React.FC = () => {
  const { data: user } = useAuthUser();
  if (!user) return null;
  const role = user.role as OfficerRole;

  return (
    <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6 max-w-xl">
      <span className="absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center bg-secondary border-2 border-ink" aria-hidden="true">
        <UserCircle2 className="w-3.5 h-3.5 text-white" />
      </span>
      <h1 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">Profile</h1>
      <dl className="space-y-3">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Name</dt>
          <dd className="text-ink font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Email</dt>
          <dd className="text-ink font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Role</dt>
          <dd className="text-ink font-medium">{ROLE_LABELS[role]}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Department</dt>
          <dd className="text-ink font-medium">{ROLE_DEPARTMENT[role].replace(/_/g, ' ')}</dd>
        </div>
      </dl>
    </div>
  );
};

export default OfficerProfilePage;
