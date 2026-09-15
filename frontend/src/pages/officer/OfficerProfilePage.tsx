import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthUser } from '../../features/auth/auth';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import {
  ActivityTimeline,
  ContactMethodsCard,
  DocumentsCredentialsCard,
  GISPermissionsCard,
  JurisdictionCard,
  PersonalProfessionalCard,
  PreferencesCard,
  ProfileActionBar,
  ProfilePageHeader,
  ProfileSummaryCard,
  SecurityCard,
  VerificationCard,
} from '../../features/auth/profile-components';
import { OfficerRole, ROLE_DEPARTMENT, ROLE_LABELS } from '../../features/officer/officerAuth';

function formatDate(value?: string): string {
  if (!value) return '15 Apr 2022';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Officer profile is intentionally assembled from the shared profile cards.
 * Only the existing profile-details and contact cards mutate account data;
 * operational cards are isolated presentation fallbacks until matching APIs
 * are supplied by the platform.
 */
const OfficerProfilePage: React.FC = () => {
  const { data: user } = useAuthUser();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  if (!user) return null;

  const role = user.role as OfficerRole;
  const roleLabel = ROLE_LABELS[role] ?? 'Land Records Officer';
  const department = (ROLE_DEPARTMENT[role] ?? 'LAND_RECORDS').replace(/_/g, ' ');
  const showUnavailable = (label: string) => setNotice(`${label} is available through the authorised administration service.`);

  const downloadSummary = () => {
    const summary = [
      'BhoomiSetu Officer Profile Summary',
      `Name: ${user.name}`,
      `Role: ${roleLabel}`,
      `Department: ${department}`,
      `Member since: ${formatDate(user.createdAt)}`,
      'Jurisdiction: Pune, Maharashtra / Haveli',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([summary], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bhoomisetu-profile-summary.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 pb-8">
      <ProfilePageHeader onEditClick={() => document.getElementById('profile-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />

      <ProfileSummaryCard
        name={user.name}
        role={roleLabel}
        department={department}
        status="Verified Government Account"
        memberSince={formatDate(user.createdAt)}
        lastActive="11 Sep 2026, 10:24 AM"
        completeness={user.mobileNumber ? 92 : 82}
        message="Add your mobile number and emergency contact to complete your profile."
      />

      {notice && (
        <div role="status" className="border-2 border-accent/60 bg-accent/10 px-4 py-3 text-sm text-ink flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold uppercase underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        <div className="xl:col-span-3 space-y-6">
          <PersonalProfessionalCard user={user} />
          <div id="profile-details" className="scroll-mt-6"><ProfileDetailsCard user={user} /></div>
          <JurisdictionCard />
          <GISPermissionsCard onAccessMatrixClick={() => showUnavailable('The access matrix')} onPermissionRequestClick={() => showUnavailable('Permission change requests')} />
          <DocumentsCredentialsCard onDocumentAction={(document, action) => showUnavailable(`${action} for ${document}`)} />
        </div>
        <div className="xl:col-span-2 space-y-6">
          <VerificationCard
            user={user}
            onVerifyClick={() => document.getElementById('contact-methods')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            onUpdateClick={() => document.getElementById('profile-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            onHistoryClick={() => showUnavailable('Verification history')}
          />
          <div id="contact-methods" className="scroll-mt-6"><ContactMethodsCard user={user} /></div>
          <SecurityCard on2facClick={() => showUnavailable('Two-factor authentication')} onSessionsClick={() => showUnavailable('Active session review')} onPasswordClick={() => showUnavailable('Password change')} />
          <PreferencesCard />
          <ActivityTimeline onViewLogClick={() => showUnavailable('The activity log')} />
        </div>
      </div>

      <ProfileActionBar
        onEditClick={() => document.getElementById('profile-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        onDownloadClick={downloadSummary}
        onSupportClick={() => navigate('/contact-us')}
      />
    </div>
  );
};

export default OfficerProfilePage;