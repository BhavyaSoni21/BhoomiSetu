import React from 'react';
import { useAuthUser } from '../../features/auth/auth';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import ContactMethodCard from '../../features/auth/ContactMethodCard';
import { ProfileHeader } from '../../features/auth/profile-components';
import { useTranslation } from '../../context/LanguageContext';

// Deliberately much simpler than OfficerProfilePage.tsx - no department/
// jurisdiction/GIS-permission mock cards, since a Verifier has none of
// that scope. Just the real account fields every role gets.
const VerifierProfilePage: React.FC = () => {
  const { data: user } = useAuthUser();
  const { t } = useTranslation();
  if (!user) return null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-12">
      <ProfileHeader title={t('verifierProfile.title')} subtitle={t('verifierProfile.subtitle')} />
      <ProfileDetailsCard user={user} />
      <div className="space-y-3">
        <ContactMethodCard method="EMAIL" user={user} />
        <ContactMethodCard method="MOBILE" user={user} />
      </div>
    </div>
  );
};

export default VerifierProfilePage;
