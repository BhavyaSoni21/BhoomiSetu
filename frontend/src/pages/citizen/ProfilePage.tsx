import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserCircle2 } from 'lucide-react';
import { useAuthUser } from '../../features/auth/auth';
import ComingSoonCard from '../../features/citizen/ComingSoonCard';

// The real page the disabled "Profile" pill on MyParcels.tsx (added earlier
// this session) was standing in for. What's genuinely built today is just
// the account info already available from the signed-in session
// (docs/FRONTEND_UPGRADE_SPEC.md §3's mobile/email add-and-verify flow is
// still unbuilt, blocked on the SMS gateway decision - see
// docs/AUTH_VERIFICATION_UPGRADE.md).
const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();

  return (
    <div className="max-w-xl space-y-6">
      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink flex items-center justify-center" aria-hidden="true">
          <UserCircle2 className="w-3.5 h-3.5 text-white" />
        </span>
        <h1 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">
          {t('citizenPortal.profileHeading')}
        </h1>
        <dl className="space-y-3">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileNameLabel')}</dt>
            <dd className="text-ink font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileEmailLabel')}</dt>
            <dd className="text-ink font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileRoleLabel')}</dt>
            <dd className="text-ink font-medium">{t('citizenPortal.profileRoleValue')}</dd>
          </div>
        </dl>
      </div>

      <ComingSoonCard
        icon={UserCircle2}
        title={t('placeholders.profileTitle')}
        description={t('placeholders.profileDesc')}
        accentClass="bg-secondary"
      />
    </div>
  );
};

export default ProfilePage;
