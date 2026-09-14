import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import BackButton from '../../components/BackButton';
import { useAuthUser } from '../../features/auth/auth';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import ContactMethodCard from '../../features/auth/ContactMethodCard';
import VerificationCard from '../../features/auth/profile-components/VerificationCard';
import SecurityCard from '../../features/auth/profile-components/SecurityCard';
import PreferencesCard from '../../features/auth/profile-components/PreferencesCard';
import ProfileSummaryCard from '../../features/auth/profile-components/ProfileSummaryCard';
import ProfileActionBar from '../../features/auth/profile-components/ProfileActionBar';
import UserManagementSummary from '../../features/auth/profile-components/UserManagementSummary';
import GovernanceSummary from '../../features/auth/profile-components/GovernanceSummary';
import AdminActivitySummary from '../../features/auth/profile-components/AdminActivitySummary';

const AdminProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();

  if (!user) return null;
  const createdAt = user.createdAt ? user.createdAt : '';
  const lastActive = '11 Sep 2026, 10:24 AM';
  const initials = user.name ? user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'AD';

  return (
    <div className="max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <BackButton variant="ink" label="Back" />
          <h1 className="text-3xl font-black uppercase tracking-tight font-display text-ink mt-3">
            Administrator Profile
          </h1>
          <p className="text-sm text-ink/60 mt-1">
            Manage your system administrator account, security settings, and preferences.
          </p>
          <p className="text-xs text-ink/40 mt-2 font-mono">
            Last updated: {lastActive}
          </p>
        </div>
      </div>

      {/* ── Profile Summary ── */}
      <ProfileSummaryCard
        name={user.name}
        role="System Administrator"
        department="Administration"
        status="Verified Government Account"
        memberSince={createdAt}
        lastActive={lastActive}
        completeness={85}
        message="Your profile is nearly complete. Add jurisdictional details for faster request routing."
      />

      {/* ── Row 1 (2-col): Editable account details | Contact method verification ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfileDetailsCard user={user} />

        <div className="bg-surface border-2 border-ink shadow-hard-md p-6">
          <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-1">
            Contact Methods
          </h2>
          <p className="text-sm text-ink/60 mb-4">
            Verify your email and mobile number for system notifications and 2FA.
          </p>
          <div className="space-y-3">
            <ContactMethodCard method="EMAIL" user={user} />
            <ContactMethodCard method="MOBILE" user={user} />
          </div>
        </div>
      </div>

      {/* ── Row 2 (2-col): Security | Preferences ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecurityCard />
        <PreferencesCard />
      </div>

      {/* ── Administrative Access & Permissions ── */}
      <div className="bg-surface border-2 border-ink shadow-hard-md overflow-hidden">
        <div className="border-b-2 border-ink/20 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
            <h3 className="text-lg font-black uppercase tracking-tight font-display text-ink">Administrative Access & Permissions</h3>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-ink/60 mb-4">
            System administrator permissions across land-governance modules.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-primary border border-ink rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">User Management</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-accent/20 text-secondary-strong border-accent/40 rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">Role Management</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-primary/15 text-primary border-primary/50 rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">Permission Management</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-primary/15 text-primary border-primary/50 rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">Request Workflow Administration</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-primary/15 text-primary border-primary/50 rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">GIS Configuration</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-primary/15 text-primary border-primary/50 rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">Governance Configuration</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-primary/15 text-primary border-primary/50 rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">Audit Access</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-4 h-4 bg-primary/15 text-primary border-primary/50 rounded-full shrink-0" aria-hidden="true" />
              <span className="text-sm text-ink font-medium">System Configuration</span>
            </div>
            <div>
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                View Full Permission Matrix
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── User / Access Management Summary ── */}
      <UserManagementSummary />

      {/* ── Governance / System Summary ── */}
      <GovernanceSummary />

      {/* ── Administrative Activity / Audit Summary ── */}
      <AdminActivitySummary />

      {/* ── Bottom Action Bar ── */}
      <ProfileActionBar
        onSaveClick={() => {}}
        onCancelClick={() => {}}
        onDownloadClick={() => {}}
        onSupportClick={() => {}}
        onEditClick={() => {}}
      />
    </div>
  );
};

export default AdminProfilePage;
