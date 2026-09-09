import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CheckCircle2, Mail, Phone, UserCircle2, FolderOpen, Pencil } from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser, useUpdateContact, useUpdateProfileDetails, AuthUser, ContactMethod } from '../../features/auth/auth';
import OtpEntryForm from '../../features/auth/OtpEntryForm';
import AuthenticatedDocumentImage from '../../features/parcels/AuthenticatedDocumentImage';
import { ParcelSummary } from '../../types/parcel';
import { Workflow } from '../../types/workflow';
import { ParcelDocument } from '../../types/parcelDocument';

type ProfileTab = 'account' | 'documents';

type Mode = 'view' | 'edit' | 'otp';

interface ContactMethodCardProps {
  method: ContactMethod;
  user: AuthUser;
}

// Add: enter the missing method -> verify -> added. Change: enter new value
// -> verify new value -> only then does it replace the old one
// (docs/FRONTEND_UPGRADE_SPEC.md §3) - the backend already enforces this
// (AuthService.addOrChangeContact stages a change into
// pendingEmail/pendingMobileNumber rather than overwriting immediately);
// this component just walks the citizen through whichever step their
// current state calls for.
const ContactMethodCard: React.FC<ContactMethodCardProps> = ({ method, user }) => {
  const { t } = useTranslation();
  const updateContactMutation = useUpdateContact();
  const [mode, setMode] = useState<Mode>('view');
  const [inputValue, setInputValue] = useState('');
  const [otpTarget, setOtpTarget] = useState('');

  const Icon = method === 'EMAIL' ? Mail : Phone;
  const label = method === 'EMAIL' ? t('citizenPortal.profileEmailLabel') : t('citizenPortal.profileMobileLabel');
  const currentValue = method === 'EMAIL' ? user.email : user.mobileNumber;
  const verified = method === 'EMAIL' ? user.emailVerified : user.mobileVerified;
  const pendingValue = method === 'EMAIL' ? user.pendingEmail : user.pendingMobileNumber;

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateContactMutation.mutate(
      { method, email: method === 'EMAIL' ? inputValue : undefined, mobileNumber: method === 'MOBILE' ? inputValue : undefined },
      {
        onSuccess: () => {
          setOtpTarget(inputValue);
          setMode('otp');
        },
      },
    );
  };

  const errorMessage =
    updateContactMutation.isError &&
    (axios.isAxiosError(updateContactMutation.error) && updateContactMutation.error.response?.data?.message
      ? String(updateContactMutation.error.response.data.message)
      : t('citizenPortal.profileContactUpdateError'));

  if (mode === 'otp') {
    return (
      <div className="border-2 border-ink/20 p-4">
        <h3 className="font-bold text-ink flex items-center gap-1.5 mb-3">
          <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          {label}
        </h3>
        <OtpEntryForm method={method} target={otpTarget} onVerified={() => setMode('view')} onCancel={() => setMode('view')} />
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div className="border-2 border-ink/20 p-4">
        <h3 className="font-bold text-ink flex items-center gap-1.5 mb-3">
          <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          {label}
        </h3>
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <input
            type={method === 'EMAIL' ? 'email' : 'tel'}
            inputMode={method === 'MOBILE' ? 'numeric' : undefined}
            required
            pattern={method === 'MOBILE' ? '[0-9]{10}' : undefined}
            placeholder={method === 'EMAIL' ? t('auth.emailPlaceholder') : t('auth.mobilePlaceholder')}
            className="block w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
            value={inputValue}
            onChange={(e) => setInputValue(method === 'MOBILE' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value)}
          />
          {errorMessage && <p className="text-sm font-medium text-secondary-strong">{errorMessage}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateContactMutation.isLoading}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {updateContactMutation.isLoading ? t('auth.otpVerifying') : t('citizenPortal.profileSendCodeCta')}
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="px-4 py-2 border-2 border-ink text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
            >
              {t('citizenPortal.profileCancelCta')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="border-2 border-ink/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink flex items-center gap-1.5">
            <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            {label}
          </h3>
          {currentValue ? (
            <>
              <p className="text-ink/80 mt-1">{currentValue}</p>
              <span
                className={`inline-flex items-center gap-1 mt-1.5 border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  verified ? 'bg-primary/15 text-primary border-primary/50' : 'bg-accent/20 text-secondary-strong border-accent/50'
                }`}
              >
                {verified && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                {verified ? t('citizenPortal.profileVerifiedBadge') : t('citizenPortal.profileUnverifiedBadge')}
              </span>
              {pendingValue && (
                <p className="text-xs text-secondary-strong mt-1.5">{t('citizenPortal.profilePendingNote', { value: pendingValue })}</p>
              )}
            </>
          ) : (
            <p className="text-ink/50 mt-1 text-sm">{t('citizenPortal.profileNotProvided')}</p>
          )}
        </div>

        {pendingValue || (currentValue && !verified) ? (
          <button
            type="button"
            onClick={() => {
              setOtpTarget(pendingValue ?? currentValue ?? '');
              setMode('otp');
            }}
            className="shrink-0 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
          >
            {t('citizenPortal.profileVerifyCta')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setMode('edit');
            }}
            className="shrink-0 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
          >
            {currentValue ? t('citizenPortal.profileChangeCta') : t('citizenPortal.profileAddCta')}
          </button>
        )}
      </div>
    </div>
  );
};

interface ProfileDetailsCardProps {
  user: AuthUser;
}

// Profile "more info, editable" (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
// no OTP step, unlike ContactMethodCard above (name/address/governmentIdNumber/
// occupation aren't identity-verification critical). These are exactly the
// fields the simplified Raise Request flow auto-fills onto a workflow
// server-side (workflows.controller.ts's create()), so keeping them current
// here is what makes that auto-fill actually useful.
const ProfileDetailsCard: React.FC<ProfileDetailsCardProps> = ({ user }) => {
  const { t } = useTranslation();
  const updateDetailsMutation = useUpdateProfileDetails();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    address: user.address ?? '',
    governmentIdNumber: user.governmentIdNumber ?? '',
    occupation: user.occupation ?? '',
  });

  const startEdit = () => {
    setForm({
      name: user.name,
      address: user.address ?? '',
      governmentIdNumber: user.governmentIdNumber ?? '',
      occupation: user.occupation ?? '',
    });
    setEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateDetailsMutation.mutate(form, { onSuccess: () => setEditing(false) });
  };

  const errorMessage =
    updateDetailsMutation.isError &&
    (axios.isAxiosError(updateDetailsMutation.error) && updateDetailsMutation.error.response?.data?.message
      ? String(updateDetailsMutation.error.response.data.message)
      : t('citizenPortal.profileContactUpdateError'));

  if (editing) {
    return (
      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">
          {t('citizenPortal.profileDetailsHeading')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="profileNameInput" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('citizenPortal.profileNameLabel')}</label>
            <input
              id="profileNameInput"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="profileAddressInput" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('citizenPortal.profileAddressLabel')}</label>
            <input
              id="profileAddressInput"
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="profileGovernmentIdInput" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('citizenPortal.profileGovernmentIdLabel')}</label>
            <input
              id="profileGovernmentIdInput"
              type="text"
              value={form.governmentIdNumber}
              onChange={(e) => setForm((f) => ({ ...f, governmentIdNumber: e.target.value }))}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="profileOccupationInput" className="block text-xs font-bold uppercase tracking-widest text-ink mb-1">{t('citizenPortal.profileOccupationLabel')}</label>
            <input
              id="profileOccupationInput"
              type="text"
              value={form.occupation}
              onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
              className="w-full border-2 border-ink bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary"
            />
          </div>
          {errorMessage && <p className="text-sm font-medium text-secondary-strong">{errorMessage}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateDetailsMutation.isLoading}
              className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {updateDetailsMutation.isLoading ? '...' : t('citizenPortal.profileSaveCta')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 border-2 border-ink text-ink font-bold uppercase text-xs tracking-wider hover:bg-muted transition"
            >
              {t('citizenPortal.profileCancelCta')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink">
          {t('citizenPortal.profileDetailsHeading')}
        </h2>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-ink bg-surface text-ink font-bold text-xs uppercase tracking-wider hover:bg-muted transition"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          {t('citizenPortal.profileEditCta')}
        </button>
      </div>
      <p className="text-sm text-ink/60 mb-4">{t('citizenPortal.profileDetailsDesc')}</p>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileNameLabel')}</dt>
          <dd className="text-ink font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileAddressLabel')}</dt>
          <dd className="text-ink font-medium">{user.address || t('citizenPortal.profileNotProvided')}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileGovernmentIdLabel')}</dt>
          <dd className="text-ink font-medium">{user.governmentIdNumber || t('citizenPortal.profileNotProvided')}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileOccupationLabel')}</dt>
          <dd className="text-ink font-medium">{user.occupation || t('citizenPortal.profileNotProvided')}</dd>
        </div>
      </dl>
    </div>
  );
};

interface ParcelDocumentsCardProps {
  parcel: ParcelSummary;
}

// One card per linked parcel (docs/FRONTEND_UPGRADE_SPEC.md follow-up,
// Profile's "Documents" tab going from ComingSoonCard to real) - lists
// whatever land property papers are on file (GET /parcels/:id/documents,
// public metadata) with a thumbnail of each (AuthenticatedDocumentImage,
// since the actual file endpoint is auth-gated).
const ParcelDocumentsCard: React.FC<ParcelDocumentsCardProps> = ({ parcel }) => {
  const { t } = useTranslation();
  const { data: documents = [] } = useQuery<ParcelDocument[]>(
    ['parcel-documents', parcel.id],
    async () => (await apiService.get(`/parcels/${parcel.id}/documents`)).data,
  );

  return (
    <div className="border-2 border-ink/20 p-4">
      <h3 className="font-bold text-ink mb-2">{parcel.ulpin ?? `Parcel #${parcel.id.substring(0, 8)}...`}</h3>
      {documents.length === 0 ? (
        <p className="text-sm text-ink/50">{t('citizenPortal.profileDocumentsEmpty')}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="w-32">
              <AuthenticatedDocumentImage
                src={`/parcels/${parcel.id}/documents/${doc.id}/file`}
                alt={doc.documentType}
                className="w-32 h-40 object-cover border-2 border-ink"
                zoomable
              />
              <span
                className={`mt-1 block text-center border-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  doc.registrationStatus === 'REGISTERED'
                    ? 'bg-primary/15 text-primary border-primary/50'
                    : 'bg-accent/20 text-secondary-strong border-accent/50'
                }`}
              >
                {doc.registrationStatus}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

const TABS: { key: ProfileTab; labelKey: string }[] = [
  { key: 'account', labelKey: 'citizenPortal.profileAccountTab' },
  { key: 'documents', labelKey: 'citizenPortal.profileDocumentsTab' },
];

// The real page the disabled "Profile" pill on MyParcels.tsx (added earlier
// this session) was standing in for, and the real feature the "coming soon"
// contact-management card stood in for during Phase 1 - now built
// end-to-end against POST /auth/profile/contact + /auth/verify-otp
// (docs/FRONTEND_UPGRADE_SPEC.md §3). Restructured into tabs 2026-09-09 (the
// user's follow-up: "more info in the profile and the documents tabs should
// also be part of profile") - Account gained member-since/linked-parcel/
// request-count info plus an editable Profile Details form (name/address/
// governmentIdNumber/occupation). The standalone instant-verify feature
// (Verify Documents tab, DocumentVerificationPanel) was removed entirely in
// a later follow-up - that job is now done by raising a Verify Documents
// request against an already-linked parcel instead (RaiseRequestPage/
// Parcel360View); Documents went from a ComingSoonCard placeholder to
// real land-property-paper listings per linked parcel.
const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  const [searchParams] = useSearchParams();
  // Deep-linkable via ?tab=documents (any other/missing value falls back to
  // the default Account tab).
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab === 'documents' ? initialTab : 'account');

  const { data: myParcels } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
    { enabled: !!user },
  );
  const { data: myWorkflows } = useQuery<Workflow[]>(
    ['my-workflows'],
    async () => (await apiService.get('/workflows/mine')).data,
    { enabled: !!user },
  );

  if (!user) return null;

  return (
    <div className="max-w-xl space-y-6">
      <div className="border-b-2 border-ink/20">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Profile sections">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-ink/50 hover:border-ink/30 hover:text-ink'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'account' && (
        <>
          <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
            <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink flex items-center justify-center" aria-hidden="true">
              <UserCircle2 className="w-3.5 h-3.5 text-white" />
            </span>
            <h1 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-4">
              {t('citizenPortal.profileHeading')}
            </h1>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileNameLabel')}</dt>
                <dd className="text-ink font-medium">{user.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileRoleLabel')}</dt>
                <dd className="text-ink font-medium">{t('citizenPortal.profileRoleValue')}</dd>
              </div>
              {user.createdAt && (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileMemberSinceLabel')}</dt>
                  <dd className="text-ink font-medium">{formatDate(user.createdAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileLinkedParcelsLabel')}</dt>
                <dd className="text-ink font-medium">{myParcels?.total ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-widest text-ink/50">{t('citizenPortal.profileTotalRequestsLabel')}</dt>
                <dd className="text-ink font-medium">{myWorkflows?.length ?? '—'}</dd>
              </div>
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
        </>
      )}

      {activeTab === 'documents' && (
        <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink flex items-center justify-center" aria-hidden="true">
            <FolderOpen className="w-3.5 h-3.5 text-white" />
          </span>
          <h2 className="text-lg font-black uppercase tracking-tight font-display text-ink mb-1">
            {t('placeholders.documentsTitle')}
          </h2>
          <p className="text-sm text-ink/60 mb-4">{t('placeholders.documentsDesc')}</p>
          {!myParcels?.parcels.length ? (
            <p className="text-sm text-ink/50">{t('citizenPortal.profileDocumentsNoParcels')}</p>
          ) : (
            <div className="space-y-3">
              {myParcels.parcels.map((parcel) => (
                <ParcelDocumentsCard key={parcel.id} parcel={parcel} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
