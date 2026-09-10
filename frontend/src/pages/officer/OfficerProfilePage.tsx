import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserCircle2 } from 'lucide-react';
import { useAuthUser } from '../../features/auth/auth';
import ContactMethodCard from '../../features/auth/ContactMethodCard';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import { OfficerRole, ROLE_DEPARTMENT, ROLE_LABELS } from '../../features/officer/officerAuth';
import BackButton from '../../components/BackButton';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Officer's own account info (docs/FRONTEND_UPGRADE_SPEC.md §5) - built out
// 2026-09-10 (docs/ADMIN_PANEL_ISSUES.md Officer #2, "richer Profile, same
// depth as Citizen's ProfilePage") to match the Citizen Portal's ProfilePage.tsx:
// editable name/address/government ID/occupation (ProfileDetailsCard) and
// verified email/mobile with OTP (ContactMethodCard), both extracted out of
// ProfilePage.tsx into features/auth/ so they're shared rather than
// duplicated. No second tab here (unlike Citizen's Account/Documents split) -
// an officer has no personal linked-parcel documents to show, so a lone
// "Documents" tab would be pointless.
const OfficerProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  if (!user) return null;
  const role = user.role as OfficerRole;

  return (
    <div className="max-w-xl space-y-6">
      <BackButton variant="ink" />
      <div className="relative bg-surface border-4 border-ink shadow-hard-lg p-6">
        <span className="absolute -top-3 -right-3 w-6 h-6 flex items-center justify-center bg-secondary border-2 border-ink" aria-hidden="true">
          <UserCircle2 className="w-3.5 h-3.5 text-white" />
        </span>
        <h1 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">Profile</h1>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Name</dt>
            <dd className="text-ink font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Role</dt>
            <dd className="text-ink font-medium">{ROLE_LABELS[role]}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Department</dt>
            <dd className="text-ink font-medium">{ROLE_DEPARTMENT[role].replace(/_/g, ' ')}</dd>
          </div>
          {user.createdAt && (
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">Member Since</dt>
              <dd className="text-ink font-medium">{formatDate(user.createdAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      <ProfileDetailsCard user={user} />

      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-1">
          {t('citizenPortal.profileContactHeading')}
        </h2>
        <p className="text-sm text-ink/60 mb-4">{t('citizenPortal.profileContactDesc')}</p>
        <div className="space-y-3">
          <ContactMethodCard method="EMAIL" user={user} />
          <ContactMethodCard method="MOBILE" user={user} />
        </div>
      </div>
    </div>
  );
};

export default OfficerProfilePage;
