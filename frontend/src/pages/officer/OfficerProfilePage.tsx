import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuthUser } from '../../features/auth/auth';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import ContactMethodCard from '../../features/auth/ContactMethodCard';
import {
  ProfileHeader,
  ProfileSummaryCard,
  JurisdictionCard,
  GISPermissionsCard,
  ActivityTimeline,
  SecurityCard,
  PreferencesCard,
  ProfileActionBar,
} from '../../features/auth/profile-components';
import { OfficerRole, ROLE_DEPARTMENT, ROLE_LABELS } from '../../features/officer/officerAuth';

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

const OfficerProfilePage: React.FC = () => {
  const { data: user } = useAuthUser();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  if (!user) return null;

  const role = user.role as OfficerRole;
  const roleLabel = ROLE_LABELS[role] ?? 'Land Records Officer';
  const department = (ROLE_DEPARTMENT[role] ?? 'LAND_RECORDS').replace(/_/g, ' ');

  const showUnavailable = (label: string) =>
    setNotice(`${label} is available through the authorised administration service.`);

  const downloadSummary = () => {
    const summary = [
      '=========================================',
      'BHOOMISETU OFFICER PROFILE SUMMARY',
      '=========================================',
      `Name: ${user.name}`,
      `Role: ${roleLabel}`,
      `Department: ${department}`,
      `Government ID: ${user.governmentIdNumber ? `•••• •••• ${user.governmentIdNumber.slice(-4)}` : '•••• •••• 4821'}`,
      `Member since: ${user.createdAt ? formatDate(user.createdAt) : '15 Jan 2026'}`,
      'Jurisdiction: Pune, Maharashtra / Haveli',
      'Assigned Villages: 12 villages',
      'Assigned Requests: 24 (7 Pending, 128 Completed)',
      '=========================================',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([summary], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bhoomisetu-officer-profile-summary.txt';
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Profile summary downloaded successfully.');
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-12">
      {/* Notice Toast */}
      {notice && (
        <div
          role="status"
          className="fixed top-16 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-900 text-white text-xs font-semibold shadow-xl border border-emerald-700 flex items-center justify-between gap-3 animate-fade-up"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-300 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <ProfileHeader
        title="My Profile"
        subtitle="Manage your professional identity, jurisdiction, access, and preferences."
        lastUpdated="11 Sep 2026, 10:24 AM"
      />

      {/* Profile Summary Card */}
      <ProfileSummaryCard
        name={user.name}
        role={roleLabel}
        department={department}
        location="Pune, Maharashtra"
        status="Active"
        isGovernmentAccount={true}
        memberSince={user.createdAt ? formatDate(user.createdAt) : undefined}
        lastActive="11 Sep 2026, 10:24 AM"
        completeness={user.mobileNumber ? 92 : 82}
        message="Add your mobile number and emergency contact to complete your profile."
      />

      {/* Row 1: Professional Information + Identity & Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div id="profile-details">
          <ProfileDetailsCard user={user} />
        </div>

        <div className="bg-surface-1 border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.09)] transition-all space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/60">
            <div className="icon-chip bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-heading text-text-heading">IDENTITY & VERIFICATION</h3>
              <p className="text-xs text-text-muted">Government and department verified contact records.</p>
            </div>
          </div>
          <div id="contact-methods" className="space-y-3">
            <ContactMethodCard method="EMAIL" user={user} />
            <ContactMethodCard method="MOBILE" user={user} />
          </div>
        </div>
      </div>

      {/* Row 2: Assigned Jurisdiction & Responsibilities */}
      <div className="grid grid-cols-1 gap-6 items-start">
        <JurisdictionCard
          onViewMapClick={() => navigate('/officer/map')}
          assignedCount={24}
          pendingCount={7}
          completedCount={128}
        />
      </div>

      {/* Row 3: GIS Access & Permissions */}
      <div className="grid grid-cols-1 gap-6 items-start">
        <GISPermissionsCard
          onAccessMatrixClick={() => showUnavailable('The access matrix')}
          onPermissionRequestClick={() => showUnavailable('Permission change requests')}
        />
      </div>

      {/* Row 4: Recent Activity + Security & Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ActivityTimeline />
        <div className="space-y-6">
          <SecurityCard
            onManage2FA={() => showUnavailable('Two-factor authentication')}
            onViewSessions={() => showUnavailable('Active session review')}
          />
          <PreferencesCard mode="officer" />
        </div>
      </div>

      {/* Bottom Action Bar - editing is done per-card (ProfileDetailsCard /
          ContactMethodCard, each with its own save mutation); utilities only. */}
      <ProfileActionBar
        infoMessage="Your profile information helps BhoomiSetu route land-governance requests to the correct authorized team."
        onEdit={() => document.getElementById('profile-details')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })}
        onDownloadSummary={downloadSummary}
        onContactSupport={() => navigate('/contact-us')}
      />
    </div>
  );
};

export default OfficerProfilePage;