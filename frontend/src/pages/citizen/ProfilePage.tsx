import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { UserCircle2, FolderOpen } from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser } from '../../features/auth/auth';
import ContactMethodCard from '../../features/auth/ContactMethodCard';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import AuthenticatedDocumentImage from '../../features/parcels/AuthenticatedDocumentImage';
import { ParcelSummary } from '../../types/parcel';
import { Workflow } from '../../types/workflow';
import { ParcelDocument } from '../../types/parcelDocument';
import BackButton from '../../components/BackButton';

type ProfileTab = 'account' | 'documents';

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
      <BackButton variant="ink" />
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
