import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthUser } from '../../features/auth/auth';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import ContactMethodCard from '../../features/auth/ContactMethodCard';
import {
  ProfileHeader,
  ProfileSummaryCard,
  PersonalProfessionalCard,
  IdentityVerificationCard,
  AdminAccessPermissionsCard,
  UserManagementSummary,
  GovernanceSummary,
  ContactMethodsCard,
  AdminActivitySummary,
  SecurityCard,
  PreferencesCard,
  ProfileActionBar,
} from '../../features/auth/profile-components';

function formatDate(value?: string): string {
  if (!value) return '10 Jan 2021';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

const AdminProfilePage: React.FC = () => {
  const { data: user } = useAuthUser();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  if (!user) return null;

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleDownloadSummary = () => {
    const summary = [
      '=========================================',
      'BHOOMISETU SYSTEM ADMINISTRATOR PROFILE',
      '=========================================',
      `Name: ${user.name}`,
      `Role: System Administrator`,
      `Department: Land Records (State) / Secretariat, New Delhi`,
      `Admin ID: ADM******9087`,
      `Email: ${user.email}`,
      `Access Scope: Full System Access (8 Domains)`,
      `Managed Users: 184 (32 Active Officers)`,
      `Districts Managed: 5 Districts`,
      `Export Timestamp: ${new Date().toLocaleString()}`,
      '=========================================',
    ].join('\n');

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bhoomisetu-admin-profile-summary.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Admin profile summary downloaded successfully.');
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-12">
      {/* Toast Notification */}
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
        subtitle="Manage your administrative identity, access, and system preferences."
        lastUpdated="11 Sep 2026, 10:24 AM"
      />

      {/* Profile Summary Card */}
      <ProfileSummaryCard
        name={user.name}
        role="System Administrator"
        department="Land Records (State)"
        location="New Delhi, India"
        status="Active"
        isGovernmentAccount={true}
        isAdminAccount={true}
        memberSince={user.createdAt ? formatDate(user.createdAt) : '10 Jan 2021'}
        lastActive="11 Sep 2026, 10:24 AM"
        completeness={90}
        message="Your profile is almost complete."
      />

      {/* Profile Details Edit Form Target */}
      <div id="admin-profile-details" className="scroll-mt-6">
        <ProfileDetailsCard user={user} />
      </div>

      {/* Row 1: Administrative Information + Identity & Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PersonalProfessionalCard
          user={user}
          mode="admin"
          onEdit={() => document.getElementById('admin-profile-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />
        <div className="space-y-6">
          <IdentityVerificationCard
            user={user}
            mode="admin"
            onUpdateDetails={() => document.getElementById('admin-profile-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            onViewHistory={() => showToast('Audit trail logged for verification history.')}
          />
          <div className="space-y-3">
            <ContactMethodCard method="EMAIL" user={user} />
            <ContactMethodCard method="MOBILE" user={user} />
          </div>
        </div>
      </div>

      {/* Row 2: Admin Access & Permissions + User Management Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <AdminAccessPermissionsCard
          onViewAccessMatrix={() => showToast('Full System Access matrix generated.')}
        />
        <UserManagementSummary
          managedUsers={184}
          activeOfficers={32}
          pendingApprovals={7}
          accessRequests={12}
        />
      </div>

      {/* Row 3: Governance Summary + Contact & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <GovernanceSummary
          activeConfigs={8}
          pendingChanges={2}
          districtsManaged={5}
          statesManaged={1}
        />
        <ContactMethodsCard user={user} mode="admin" />
      </div>

      {/* Row 4: Recent Admin Activity + Security & Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <AdminActivitySummary />
        <div className="space-y-6">
          <SecurityCard
            onManage2FA={() => showToast('Administrator 2FA policy enforced.')}
            onViewSessions={() => showToast('Audit log active for current sessions.')}
          />
          <PreferencesCard mode="admin" />
        </div>
      </div>

      {/* Bottom Action Bar - editing is done per-card (ProfileDetailsCard /
          ContactMethodCard, each with its own working save mutation); this bar
          is utilities only. "Edit Profile" jumps to the editable details card. */}
      <ProfileActionBar
        infoMessage="Your profile information helps BhoomiSetu maintain a secure and transparent land-governance platform."
        onEdit={() => document.getElementById('admin-profile-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        onDownloadSummary={handleDownloadSummary}
        onContactSupport={() => navigate('/contact-us')}
      />
    </div>
  );
};

export default AdminProfilePage;
