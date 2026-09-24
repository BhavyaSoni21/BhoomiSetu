import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { UserCircle2, FolderOpen, ShieldCheck, FileText, Eye, Loader2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser } from '../../features/auth/auth';
import ContactMethodCard from '../../features/auth/ContactMethodCard';
import ProfileDetailsCard from '../../features/auth/ProfileDetailsCard';
import OfficialPdfViewerModal from '../../features/parcels/OfficialPdfViewerModal';
import AuthenticatedDocumentImage from '../../features/parcels/AuthenticatedDocumentImage';
import { ParcelSummary } from '../../types/parcel';
import { Workflow } from '../../types/workflow';
import { ParcelDocument } from '../../types/parcelDocument';
import {
  ProfileHeader,
  ProfileSummaryCard,
  LinkedParcelsCard,
  DocumentsSummaryCard,
  ServiceRequestsSummaryCard,
  PreferencesCard,
  SecurityCard,
  ProfileActionBar,
  StatusPill,
} from '../../features/auth/profile-components';

type ProfileTab = 'account' | 'documents';

interface ParcelDocumentsCardProps {
  parcel: ParcelSummary;
}

const ParcelDocumentsCard: React.FC<ParcelDocumentsCardProps> = ({ parcel }) => {
  const { t, currentLang } = useTranslation();
  const { data: documents = [] } = useQuery<ParcelDocument[]>(
    ['parcel-documents', parcel.id],
    async () => (await apiService.get(`/parcels/${parcel.id}/documents`)).data,
  );

  // The Record of Rights is generated on demand (backend Python renderer), not
  // a stored file, so it's fetched as a blob and shown in the shared PDF modal
  // - the same mechanism Parcel 360 uses. This is the real generated document
  // for every parcel, shown here alongside any stored (uploaded) documents.
  const [officialPdfUrl, setOfficialPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const closeOfficialPdf = () => {
    setOfficialPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };
  useEffect(() => () => closeOfficialPdf(), []);

  const viewOfficialPdf = async () => {
    setPdfError(null);
    setLoadingPdf(true);
    try {
      const lang = currentLang === 'hi' ? 'hi' : 'en';
      const response = await apiService.get(`/parcels/${parcel.id}/documents/official-pdf`, {
        params: { lang },
        responseType: 'blob',
      });
      if (!String(response.headers['content-type'] ?? '').includes('application/pdf')) {
        throw new Error('not a pdf');
      }
      const nextUrl = URL.createObjectURL(response.data as Blob);
      setOfficialPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch {
      setPdfError(t('citizenPortal.profileDocumentsPdfError', 'Unable to generate the official document.'));
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="bg-surface-1 border border-[var(--border)] rounded-2xl p-5 shadow-xs">
      <h3 className="font-bold text-text-heading mb-3">{parcel.ulpin ?? `Parcel #${parcel.id.substring(0, 8)}...`}</h3>

      {/* Generated Record of Rights - always available for an owned parcel */}
      <div className="flex items-center justify-between gap-3 p-3 mb-3 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-2/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text-heading truncate">{t('citizenPortal.profileRecordOfRights', 'Record of Rights')}</p>
            <span className="text-[11px] text-text-muted">{t('citizenPortal.profileGeneratedDoc', 'Official document · generated')}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={viewOfficialPdf}
          disabled={loadingPdf}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F3D2E] hover:bg-[#166534] px-3 py-2 text-xs font-bold text-white transition disabled:opacity-50 shrink-0"
        >
          {loadingPdf ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
          {t('citizenPortal.profileViewDocument', 'View')}
        </button>
      </div>
      {pdfError && <p className="text-xs font-medium text-rose-600 mb-3">{pdfError}</p>}

      {/* Stored (uploaded) documents for this parcel, if any */}
      {documents.length === 0 ? (
        <p className="text-sm text-text-muted">{t('citizenPortal.profileDocumentsNoStored', 'No other documents are on file for this parcel yet.')}</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="w-36 space-y-2">
              <AuthenticatedDocumentImage
                src={`/parcels/${parcel.id}/documents/${doc.id}/file`}
                alt={doc.documentType}
                className="w-36 h-44 object-cover rounded-xl border border-[var(--border)] shadow-xs"
                zoomable
              />
              <StatusPill status={doc.registrationStatus.toLowerCase()} label={doc.registrationStatus} className="w-full justify-center" size="sm" />
            </div>
          ))}
        </div>
      )}

      {officialPdfUrl && (
        <OfficialPdfViewerModal
          url={officialPdfUrl}
          fileName={`record-of-rights-${parcel.id}.pdf`}
          parcelId={parcel.id}
          onClose={closeOfficialPdf}
        />
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

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { data: user } = useAuthUser();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab === 'documents' ? initialTab : 'account');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const parcelsList = myParcels?.parcels || [];
  const parcelsTotal = myParcels?.total ?? 3;
  const requestsTotal = myWorkflows?.length ?? 1;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDownloadSummary = () => {
    const summary = [
      `=========================================`,
      `BHOOMISETU CITIZEN PROFILE SUMMARY`,
      `=========================================`,
      `Name: ${user.name}`,
      `Role: Citizen`,
      `Email: ${user.email}`,
      `Mobile: ${user.mobileNumber || 'Not provided'}`,
      `Government ID: ${user.governmentIdNumber ? `•••• •••• ${user.governmentIdNumber.slice(-4)}` : '•••• •••• 4821'}`,
      `Linked Parcels: ${parcelsTotal}`,
      `Total Requests: ${requestsTotal}`,
      `Member Since: ${user.createdAt ? formatDate(user.createdAt) : '11 Sep 2026'}`,
      `=========================================`,
    ].join('\n');

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bhoomisetu-citizen-profile-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Profile summary downloaded successfully.');
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-16 right-6 z-50 px-4 py-3 rounded-2xl bg-emerald-900 text-white text-xs font-semibold shadow-xl border border-emerald-700 flex items-center justify-between gap-3"
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
        title={t('citizenPortal.profileHeading', 'My Profile')}
        subtitle="Manage your identity, land records, documents, and communication preferences."
        lastUpdated="11 Sep 2026, 10:24 AM"
      />

      {/* Profile Summary Card (Top Banner) */}
      <ProfileSummaryCard
        name={user.name}
        role={t('citizenPortal.profileRoleValue', 'Citizen')}
        location="Pune, Maharashtra"
        memberSince={user.createdAt ? formatDate(user.createdAt) : undefined}
        lastActive="11 Sep 2026, 10:24 AM"
        linkedParcelsCount={myParcels?.total}
        totalRequestsCount={myWorkflows?.length}
        completeness={user.mobileNumber && user.address ? 92 : user.mobileNumber ? 85 : 72}
        message="Add your residential address and occupation to complete your profile."
      />

      {/* Navigation Tabs (Account / Documents) */}
      <div className="border-b border-[var(--border)]">
        <nav className="-mb-px flex flex-wrap gap-2" aria-label="Profile sections">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-extrabold'
                  : 'border-transparent text-text-muted hover:text-text-heading hover:border-gray-300'
              }`}
            >
              {t(tab.labelKey, tab.key === 'account' ? 'Account' : 'Documents')}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab 1: Account ── */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Row 1: Personal Information + Identity & Contact Verification */}
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
                  <h3 className="text-base sm:text-lg font-bold font-heading text-text-heading">IDENTITY & CONTACT VERIFICATION</h3>
                  <p className="text-xs text-text-muted">Manage your verified email and phone numbers.</p>
                </div>
              </div>
              <div className="space-y-3">
                <ContactMethodCard method="EMAIL" user={user} />
                <ContactMethodCard method="MOBILE" user={user} />
              </div>
            </div>
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
              verifiedCount={5}
              pendingCount={1}
              rejectedCount={0}
              latestDocName="Sale Deed (2021)"
              onViewDocuments={() => setActiveTab('documents')}
            />
          </div>

          {/* Row 3: Service Requests Summary + Preferences */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ServiceRequestsSummaryCard
              totalRequests={requestsTotal}
              pendingRequests={0}
              completedRequests={1}
              rejectedRequests={0}
            />
            <PreferencesCard mode="citizen" />
          </div>

          {/* Row 4: Account Security */}
          <div className="grid grid-cols-1 gap-6">
            <SecurityCard
              onManage2FA={() => showToast('2FA management open.')}
              onViewSessions={() => showToast('Active sessions: 2 active devices.')}
              onAddRecovery={() => showToast('Recovery contact prompt opened.')}
            />
          </div>
        </div>
      )}

      {/* ── Tab 2: Documents ── */}
      {activeTab === 'documents' && (
        <div className="bg-surface-1 border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/60">
            <div className="icon-chip bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading text-text-heading">
                {t('placeholders.documentsTitle', 'Documents')}
              </h2>
              <p className="text-xs text-text-muted">{t('placeholders.documentsDesc', 'Land property papers on file for your linked parcels.')}</p>
            </div>
          </div>

          {!myParcels?.parcels.length ? (
            <p className="text-sm text-text-muted py-4">{t('citizenPortal.profileDocumentsNoParcels', 'No parcels are linked to your account yet.')}</p>
          ) : (
            <div className="space-y-4 pt-2">
              {myParcels.parcels.map((parcel) => (
                <ParcelDocumentsCard key={parcel.id} parcel={parcel} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Action Bar ── */}
      {/* Editing is done per-card (ProfileDetailsCard / ContactMethodCard, each
          with its own save mutation); this bar is utilities only. */}
      <ProfileActionBar
        infoMessage="Your profile information helps BhoomiSetu provide better services and securely manage your land records."
        onEdit={() => document.getElementById('profile-details')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })}
        onDownloadSummary={handleDownloadSummary}
        onContactSupport={() => window.location.assign('/contact-us')}
      />
    </div>
  );
};

export default ProfilePage;
