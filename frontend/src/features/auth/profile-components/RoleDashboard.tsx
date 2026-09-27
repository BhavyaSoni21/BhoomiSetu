import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthUser, UserRole } from '../auth';
import { OFFICER_ROLES, ROLE_DEPARTMENT, OfficerRole } from '../../officer/officerAuth';
import apiService from '../../../services/apiService';
import { ParcelSummary } from '../../../types/parcel';
import { Workflow } from '../../../types/workflow';
import { ParcelDocument } from '../../../types/parcelDocument';
import { ManagedUser } from '../../../types/user';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { PersonalProfessionalCard } from './PersonalProfessionalCard';
import { IdentityVerificationCard } from './IdentityVerificationCard';
import { LinkedParcelsCard } from './LinkedParcelsCard';
import { DocumentsSummaryCard } from './DocumentsSummaryCard';
import { ServiceRequestsSummaryCard } from './ServiceRequestsSummaryCard';
import { JurisdictionCard } from './JurisdictionCard';
import { GISPermissionsCard } from './GISPermissionsCard';
import { AdminAccessPermissionsCard } from './AdminAccessPermissionsCard';
import { UserManagementSummary } from './UserManagementSummary';
import { GovernanceSummary } from './GovernanceSummary';
import { ContactMethodsCard } from './ContactMethodsCard';
import { ActivityTimeline } from './ActivityTimeline';
import { AdminActivitySummary } from './AdminActivitySummary';
import { SecurityCard } from './SecurityCard';
import { PreferencesCard } from './PreferencesCard';
import { ProfileActionBar } from './ProfileActionBar';
import ContactMethodCard from '../ContactMethodCard';
import ProfileDetailsCard from '../ProfileDetailsCard';

export interface RoleDashboardProps {
  role?: 'citizen' | 'officer' | 'admin';
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({ role = 'citizen' }) => {
  const { data: user } = useAuthUser();
  // useAuthUser()'s query data is AuthUser | null | undefined (null = "no
  // session"); every card below declares its own user prop as AuthUser |
  // undefined, matching how the rest of this codebase treats "signed out".
  const authUser = user ?? undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeContactModal, setActiveContactModal] = useState<'email' | 'mobile' | null>(null);

  // Live queries for real dynamic counters
  const { data: myParcelsData } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
    { enabled: !!user && role === 'citizen' },
  );

  const { data: myWorkflows } = useQuery<Workflow[]>(
    ['my-workflows'],
    async () => (await apiService.get('/workflows/mine')).data,
    { enabled: !!user && role === 'citizen' },
  );

  const parcelsList = myParcelsData?.parcels || [];
  const parcelsTotal = myParcelsData?.total ?? 0;
  const requestsTotal = myWorkflows?.length ?? 0;
  // currentStatus values match AnalyticsDashboard.tsx's own workflow-status
  // stages (SUBMITTED/IN_PROGRESS -> pending, APPROVED -> completed,
  // REJECTED -> rejected) - same real field the Admin analytics dashboard
  // already aggregates, just filtered to this citizen's own requests here.
  const requestsPending = (myWorkflows ?? []).filter((w) => w.currentStatus === 'SUBMITTED' || w.currentStatus === 'IN_PROGRESS').length;
  const requestsCompleted = (myWorkflows ?? []).filter((w) => w.currentStatus === 'APPROVED').length;
  const requestsRejected = (myWorkflows ?? []).filter((w) => w.currentStatus === 'REJECTED').length;

  // Documents linked to this citizen's own parcels (GET /parcels/:id/documents
  // per parcel - there's no single "my documents across every parcel"
  // endpoint, so this aggregates client-side over an already-small list,
  // same N-small-requests pattern ContactMethodsCard/ParcelSearch use
  // elsewhere in this codebase).
  const { data: myDocuments } = useQuery<ParcelDocument[]>(
    ['my-documents', parcelsList.map((p) => p.id).join(',')],
    async () => {
      const results = await Promise.all(
        parcelsList.map((p) => apiService.get<ParcelDocument[]>(`/parcels/${p.id}/documents`).then((r) => r.data)),
      );
      return results.flat();
    },
    { enabled: role === 'citizen' && parcelsList.length > 0 },
  );
  const documentsVerified = (myDocuments ?? []).filter((d) => d.registrationStatus === 'REGISTERED').length;
  const documentsPending = (myDocuments ?? []).filter((d) => d.registrationStatus !== 'REGISTERED').length;
  const latestDocument = (myDocuments ?? [])[0];

  // Officer's own department queue (GET /workflows?department=X, the same
  // call AssignedRequestsPage.tsx makes) - "assigned" is every workflow with
  // a step for this department, "pending"/"completed" come from that one
  // step's own status, not the workflow's overall currentStatus (a
  // multi-department workflow can be done for this department while still
  // open elsewhere).
  const officerRole = user?.role as OfficerRole | undefined;
  const officerDepartment = officerRole && (OFFICER_ROLES as readonly string[]).includes(officerRole) ? ROLE_DEPARTMENT[officerRole] : undefined;
  const { data: officerWorkflows } = useQuery<Workflow[]>(
    ['officer-department-workflows', officerDepartment],
    async () => (await apiService.get('/workflows', { params: { department: officerDepartment } })).data,
    { enabled: role === 'officer' && !!officerDepartment },
  );
  const officerSteps = (officerWorkflows ?? [])
    .flatMap((w) => w.steps)
    .filter((s) => s.department === officerDepartment);
  const jurisdictionAssigned = officerSteps.length;
  const jurisdictionPending = officerSteps.filter((s) => s.status === 'PENDING').length;
  const jurisdictionCompleted = officerSteps.filter((s) => s.status === 'APPROVED' || s.status === 'REJECTED').length;

  // Admin's staff directory (GET /users, admin-only - same call
  // UserManagement.tsx makes) - real managed-user/active-officer counts
  // instead of a hardcoded 184/32. Pending approvals/access requests have no
  // backend concept yet (no request-for-access workflow exists), so those
  // two stay at 0 rather than a fabricated number.
  const { data: staffUsers } = useQuery<ManagedUser[]>(
    ['staff-users-summary'],
    async () => (await apiService.get('/users')).data,
    { enabled: role === 'admin' },
  );
  const managedUsersCount = staffUsers?.length ?? 0;
  const activeOfficersCount = (staffUsers ?? []).filter((u) => (OFFICER_ROLES as readonly string[]).includes(u.role)).length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDownloadSummary = () => {
    const summary = [
      `=========================================`,
      `BHOOMISETU PROFILE SUMMARY (${role.toUpperCase()})`,
      `=========================================`,
      `Name: ${user?.name || (role === 'citizen' ? 'Amit Kumar' : role === 'officer' ? 'Asha Kulkarni' : 'Rajesh Sharma')}`,
      `Role: ${role === 'citizen' ? 'Citizen' : role === 'officer' ? 'Senior Land Records Officer' : 'System Administrator'}`,
      `Email: ${user?.email || (role === 'citizen' ? 'amit.kumar@example.com' : role === 'officer' ? 'asha.kulkarni@maharashtra.gov.in' : 'rajesh.sharma@nic.in')}`,
      `Government ID: ${user?.governmentIdNumber ? `•••• •••• ${user.governmentIdNumber.slice(-4)}` : '•••• •••• 4821'}`,
      `Jurisdiction: Pune, Maharashtra / Haveli`,
      `Export Timestamp: ${new Date().toLocaleString()}`,
      `=========================================`,
    ].join('\n');

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bhoomisetu-${role}-profile-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Profile summary downloaded successfully.');
  };

  const handleContactSupport = () => {
    navigate('/contact-us');
  };

  // Profile completeness computed from real fields (was a hardcoded flip).
  // Each role has its own required set; % = filled / required, and the message
  // names what's still missing.
  const FIELD_LABELS: Record<string, string> = {
    name: 'name',
    email: 'email',
    mobileNumber: 'mobile number',
    mobileVerified: 'mobile verification',
    emailVerified: 'email verification',
    governmentIdNumber: 'government ID',
    address: 'residential address',
    occupation: 'occupation',
  };
  const REQUIRED_FIELDS: Record<string, string[]> = {
    citizen: ['name', 'email', 'mobileNumber', 'mobileVerified', 'governmentIdNumber', 'address', 'occupation'],
    officer: ['name', 'email', 'mobileNumber', 'mobileVerified', 'governmentIdNumber'],
    admin: ['name', 'email', 'mobileNumber', 'mobileVerified', 'governmentIdNumber'],
  };
  const isFilled = (u: typeof authUser, field: string): boolean => {
    if (!u) return false;
    return Boolean((u as unknown as Record<string, unknown>)[field]);
  };
  const required = REQUIRED_FIELDS[role];
  const missing = required.filter((f) => !isFilled(authUser, f));
  const completeness = Math.round(((required.length - missing.length) / required.length) * 100);
  const completenessMsg = missing.length === 0
    ? 'Your profile is complete.'
    : `Add your ${missing.slice(0, 3).map((f) => FIELD_LABELS[f]).join(', ')} to complete your profile.`;

  // Role details configuration
  const roleConfig = {
    citizen: {
      name: user?.name || 'Amit Kumar',
      role: 'Citizen',
      department: 'Public',
      location: 'Pune, Maharashtra',
      initials: user?.name ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'AK',
      completeness,
      completenessMsg,
      bannerMsg: 'Your profile information helps BhoomiSetu provide better services and securely manage your land records.',
      isGov: false,
      isAdmin: false,
    },
    officer: {
      name: user?.name || 'Asha Kulkarni',
      role: 'Senior Land Records Officer',
      department: 'Land Records',
      location: 'Pune, Maharashtra',
      initials: user?.name ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'AK',
      completeness,
      completenessMsg,
      bannerMsg: 'Your profile information helps BhoomiSetu route land-governance requests to the correct authorized team.',
      isGov: true,
      isAdmin: false,
    },
    admin: {
      name: user?.name || 'Rajesh Sharma',
      role: 'System Administrator',
      department: 'Secretariat, New Delhi',
      location: 'New Delhi, India',
      initials: user?.name ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'RS',
      completeness,
      completenessMsg,
      bannerMsg: 'Your profile information helps BhoomiSetu maintain a secure and transparent land-governance platform.',
      isGov: true,
      isAdmin: true,
    },
  }[role];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-16 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-900 text-white text-xs font-semibold shadow-xl border border-emerald-700 animate-fade-up flex items-center justify-between gap-3"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-300 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <ProfileHeader
        title="My Profile"
        subtitle={
          role === 'citizen'
            ? 'Manage your identity, land records, documents, and communication preferences.'
            : role === 'officer'
            ? 'Manage your professional identity, jurisdiction, access, and preferences.'
            : 'Manage your administrative identity, access, and system preferences.'
        }
        lastUpdated="11 Sep 2026, 10:24 AM"
      />

      {/* Profile Summary Card (Top Banner) */}
      <ProfileSummaryCard
        name={roleConfig.name}
        role={roleConfig.role}
        department={roleConfig.department}
        location={roleConfig.location}
        initials={roleConfig.initials}
        isGovernmentAccount={roleConfig.isGov}
        isAdminAccount={roleConfig.isAdmin}
        completeness={roleConfig.completeness}
        message={roleConfig.completenessMsg}
      />

      {/* Inline Edit Form when editing is active */}
      {isEditing && (
        <div id="edit-details-form" className="scroll-mt-6 p-1 rounded-2xl border-2 border-emerald-600 bg-emerald-50/20">
          <ProfileDetailsCard user={user || { id: 'temp', name: roleConfig.name, email: 'user@example.com', role: role.toUpperCase() as UserRole }} />
        </div>
      )}

      {/* Contact verification modal/drawer */}
      {activeContactModal && (
        <div className="p-4 rounded-2xl bg-surface-1 border border-emerald-500 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-text-heading">Update Contact Method ({activeContactModal.toUpperCase()})</h4>
            <button
              type="button"
              onClick={() => setActiveContactModal(null)}
              className="text-xs font-bold text-text-muted hover:text-text-heading"
            >
              Close
            </button>
          </div>
          <ContactMethodCard
            method={activeContactModal === 'email' ? 'EMAIL' : 'MOBILE'}
            user={user || { id: 'temp', name: roleConfig.name, email: 'user@example.com', role: role.toUpperCase() as UserRole }}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ROLE-SPECIFIC CARD GRIDS
      ───────────────────────────────────────────────────────────── */}

      {/* ── A. CITIZEN DASHBOARD ── */}
      {role === 'citizen' && (
        <div className="space-y-6">
          {/* Row 1: Personal Information + Identity & Contact Verification */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <PersonalProfessionalCard
              user={authUser}
              mode="citizen"
              onEdit={() => setIsEditing(!isEditing)}
            />
            <IdentityVerificationCard
              user={authUser}
              mode="citizen"
              onChangeEmail={() => setActiveContactModal('email')}
              onChangeMobile={() => setActiveContactModal('mobile')}
            />
          </div>

          {/* Row 2: Linked Parcels + Documents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <LinkedParcelsCard
              parcels={parcelsList}
              total={parcelsTotal}
              registeredCount={parcelsTotal}
              pendingCount={0}
            />
            <DocumentsSummaryCard
              verifiedCount={documentsVerified}
              pendingCount={documentsPending}
              rejectedCount={0}
              latestDocName={latestDocument?.fileName}
              onViewDocuments={() => navigate('/citizen/parcels')}
            />
          </div>

          {/* Row 3: Service Requests Summary + Preferences */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ServiceRequestsSummaryCard
              totalRequests={requestsTotal}
              pendingRequests={requestsPending}
              completedRequests={requestsCompleted}
              rejectedRequests={requestsRejected}
            />
            <PreferencesCard mode="citizen" />
          </div>

          {/* Row 4: Account Security */}
          <div className="grid grid-cols-1 gap-6">
            <SecurityCard
              onManage2FA={() => showToast('2FA settings can be updated via Security Settings.')}
              onViewSessions={() => showToast('Active sessions reviewed. 2 active devices.')}
              onAddRecovery={() => showToast('Recovery contact prompt opened.')}
            />
          </div>
        </div>
      )}

      {/* ── B. GOVERNMENT OFFICER DASHBOARD ── */}
      {role === 'officer' && (
        <div className="space-y-6">
          {/* Row 1: Professional Information + Identity & Verification */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <PersonalProfessionalCard
              user={authUser}
              mode="officer"
              onEdit={() => setIsEditing(!isEditing)}
            />
            <IdentityVerificationCard
              user={authUser}
              mode="officer"
              onUpdateDetails={() => setIsEditing(!isEditing)}
              onViewHistory={() => showToast('Verification records are audited by Department Records.')}
              onChangeMobile={() => setActiveContactModal('mobile')}
            />
          </div>

          {/* Row 2: Assigned Jurisdiction & Responsibilities (Span 2) */}
          <div className="grid grid-cols-1 gap-6 items-start">
            <JurisdictionCard
              onViewMapClick={() => navigate('/officer/map')}
              assignedCount={jurisdictionAssigned}
              pendingCount={jurisdictionPending}
              completedCount={jurisdictionCompleted}
            />
          </div>

          {/* Row 3: GIS Access & Permissions + Contact Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <GISPermissionsCard
              onAccessMatrixClick={() => showToast('Access matrix loaded for District Land Records Officer.')}
              onPermissionRequestClick={() => showToast('Permission change request sent to District Administrator.')}
            />
            <ContactMethodsCard user={authUser} mode="officer" />
          </div>

          {/* Row 4: Recent Activity + Account Security & Preferences */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ActivityTimeline />
            <div className="space-y-6">
              <SecurityCard
                onManage2FA={() => showToast('2FA settings managed.')}
                onViewSessions={() => showToast('Active officer sessions: 2 active devices.')}
              />
              <PreferencesCard mode="officer" />
            </div>
          </div>
        </div>
      )}

      {/* ── C. ADMIN DASHBOARD ── */}
      {role === 'admin' && (
        <div className="space-y-6">
          {/* Row 1: Administrative Information + Identity & Verification */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <PersonalProfessionalCard
              user={authUser}
              mode="admin"
              onEdit={() => setIsEditing(!isEditing)}
            />
            <IdentityVerificationCard
              user={authUser}
              mode="admin"
              onUpdateDetails={() => setIsEditing(!isEditing)}
              onViewHistory={() => showToast('Audit trail logged for identity verification history.')}
              onChangeMobile={() => setActiveContactModal('mobile')}
            />
          </div>

          {/* Row 2: Admin Access & Permissions + User Management Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <AdminAccessPermissionsCard
              onViewAccessMatrix={() => showToast('Full System Access matrix generated.')}
            />
            <UserManagementSummary
              managedUsers={managedUsersCount}
              activeOfficers={activeOfficersCount}
              pendingApprovals={0}
              accessRequests={0}
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
            <ContactMethodsCard user={authUser} mode="admin" />
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
        </div>
      )}

      {/* ── Bottom Action Bar (Uniform across all 3 roles) ── */}
      <ProfileActionBar
        infoMessage={roleConfig.bannerMsg}
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        onSave={() => {
          setIsEditing(false);
          showToast('Profile changes saved successfully.');
        }}
        onCancel={() => setIsEditing(false)}
        onDownloadSummary={handleDownloadSummary}
        onContactSupport={handleContactSupport}
      />
    </div>
  );
};

export default RoleDashboard;
