import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import {
  LogOut,
  MapPin,
  UserCircle2,
  Plus,
  ShieldCheck,
  Clock,
  AlertCircle,
  FileText,
  Send,
  ExternalLink,
  ChevronRight,
  Info,
  Trash2,
} from 'lucide-react';
import apiService from '../../services/apiService';
import { useAuthUser, useLogout } from '../auth/auth';
import { ParcelSummary } from '../../types/parcel';
import ParcelVerificationFlow from './ParcelVerificationFlow';

export const MyParcels: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useAuthUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCitizen = user?.role === 'CITIZEN';

  const [showNewParcelFlow, setShowNewParcelFlow] = useState(false);
  const [parcelToDelete, setParcelToDelete] = useState<ParcelSummary | null>(null);

  // Check if citizen arrived here because they were blocked from Raise Complaint
  const isBlockedFromComplaint =
    searchParams.get('from') === 'raise-request' ||
    searchParams.get('from') === 'complaint' ||
    searchParams.get('blocked') === 'true';

  const { data, isLoading, error } = useQuery<{ parcels: ParcelSummary[]; total: number }>(
    ['my-parcels'],
    async () => (await apiService.get('/parcels/mine')).data,
    { enabled: isCitizen },
  );

  const deleteSubmissionMutation = useMutation(
    async (parcelId: string) => {
      await apiService.delete(`/parcels/mine/${parcelId}`);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['my-parcels']);
        queryClient.invalidateQueries(['my-workflows']);
        setParcelToDelete(null);
      },
      onError: () => {
        alert(t('myParcels.deleteError', 'Failed to delete submission. Please try again.'));
      },
    }
  );

  if (userLoading) return null;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Contextual Banner if arrived from Raise Complaint Block - Notification Only */}
      {isBlockedFromComplaint && (
        <div className="p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200 flex items-start gap-3.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-700/50">
            <Info className="w-4 h-4 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-heading font-bold text-sm text-amber-900 dark:text-amber-100">
              {t('myParcels.blockedBannerTitle', 'Parcel Verification Required')}
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
              {t(
                'myParcels.blockedBannerDesc',
                'You need to verify and link a parcel before raising a request. Click "+ New Parcel" to get started.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Delete Pending Submission Modal */}
      {parcelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#0D261D] border-2 border-gov-border rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-base text-text-heading">
                {t('myParcels.deleteModalTitle', 'Delete Pending Submission?')}
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {t(
                'myParcels.deleteModalDesc',
                { localId: parcelToDelete.localId || `#${parcelToDelete.id.substring(0, 8)}` }
              )}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setParcelToDelete(null)}
                disabled={deleteSubmissionMutation.isLoading}
                className="px-4 py-2 rounded-xl border border-gov-border text-xs font-semibold hover:bg-surface-2 transition"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => deleteSubmissionMutation.mutate(parcelToDelete.id)}
                disabled={deleteSubmissionMutation.isLoading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-heading font-bold shadow-xs transition"
              >
                {deleteSubmissionMutation.isLoading
                  ? t('common.deleting', 'Deleting...')
                  : t('myParcels.confirmDeleteBtn', 'Yes, Delete Submission')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parcel Verification Flow Modal / Inline Section */}
      {showNewParcelFlow && (
        <div className="relative">
          <ParcelVerificationFlow
            onCancel={() => setShowNewParcelFlow(false)}
            onSuccess={() => setShowNewParcelFlow(false)}
          />
        </div>
      )}

      {/* Main Parcels Card */}
      <div className="relative bg-surface border-2 sm:border-4 border-ink shadow-hard-md p-6">
        <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-primary border-2 border-ink" aria-hidden="true" />
        
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b-2 border-ink/10">
          <div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight font-display text-ink">
              {t('myParcels.heading', 'My Parcels / Land Holdings')}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {t('myParcels.subheading', 'Verified land properties linked to your citizen account')}
            </p>
          </div>

          {isCitizen && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowNewParcelFlow((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs uppercase tracking-wider border-2 border-ink rounded-lg shadow-hard-xs transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showNewParcelFlow ? t('common.close', 'Close') : t('myParcels.newParcelButton', '+ New Parcel')}</span>
              </button>

              <Link
                to="/citizen/profile"
                className="inline-flex items-center gap-1.5 border-2 border-ink/25 px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-ink/70 hover:text-primary hover:border-primary/50 transition"
              >
                <UserCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('placeholders.profileTitle', 'Profile')}</span>
              </Link>

              <button
                onClick={logout}
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-ink/60 hover:text-secondary transition ml-1"
                title={t('myParcels.signOut', 'Sign Out')}
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {!isCitizen ? (
          <p className="text-sm text-ink/70 leading-relaxed py-4 text-center">
            <Link to="/login" className="font-bold text-primary hover:text-primary-strong underline underline-offset-2">
              {t('myParcels.signIn', 'Sign in')}
            </Link>{' '}
            {t('myParcels.signInPrompt', 'to view and manage your registered parcels.')}
          </p>
        ) : isLoading ? (
          <div className="py-12 text-center text-sm text-ink/60">
            {t('myParcels.loading', 'Loading land records...')}
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm font-medium text-secondary-strong">
            {t('myParcels.error', 'Unable to load parcels.')}
          </div>
        ) : data!.total === 0 ? (
          /* Empty State */
          <div className="py-10 text-center rounded-xl bg-surface-2/60 border-2 border-dashed border-gov-border p-6 space-y-3">
            <MapPin className="w-10 h-10 mx-auto text-text-muted mb-2" />
            <h3 className="font-heading font-bold text-base text-text-heading">
              {t('myParcels.noParcelsHeading', 'No registered parcels on your profile')}
            </h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
              {t(
                'myParcels.noParcelsDescription',
                'You must link and verify a land parcel before you can view cadastral maps, request certificates, or raise complaints.'
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowNewParcelFlow(true)}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-xs uppercase tracking-wider shadow-hard-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t('myParcels.linkParcelCta', 'Link a Parcel to Get Started')}</span>
            </button>
          </div>
        ) : (
          /* Parcel List */
          <div className="space-y-4">
            <p className="text-xs font-mono font-semibold text-text-secondary pb-1">
              {data!.total === 1
                ? t('myParcels.singleParcelSummary', { count: data!.total })
                : t('myParcels.multiParcelSummary', { count: data!.total })}
            </p>

            <div className="grid gap-4 sm:grid-cols-1">
              {data!.parcels.map((parcel) => {
                const isRegistered = parcel.status === 'Registered' || (!parcel.status && true);
                const isPending = parcel.status === 'Pending Verification';
                const isRejected = parcel.status === 'Rejected';

                return (
                  <div
                    key={parcel.id}
                    className="p-5 rounded-xl border-2 border-gov-border bg-surface-1 hover:border-brand-700 hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-heading font-bold text-base text-text-heading flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-brand-700 shrink-0" aria-hidden="true" />
                            <span>{parcel.localId || `Parcel #${parcel.id.substring(0, 8)}`}</span>
                          </h3>

                          {/* Status Badges */}
                          {isRegistered && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                              <ShieldCheck className="w-3 h-3" />
                              {t('parcelStatus.registered', 'Registered')}
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Clock className="w-3 h-3" />
                              {t('parcelStatus.pending', 'Pending Verification')}
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                              <AlertCircle className="w-3 h-3" />
                              {t('parcelStatus.rejected', 'Verification Rejected')}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-text-secondary mt-1">
                          {parcel.ulpin ? `ULPIN: ${parcel.ulpin}` : `Local ID: ${parcel.localId || 'N/A'}`} &middot; Region: <span className="font-semibold">{parcel.stateCode}-{parcel.districtCode}</span> ({parcel.localBodyCode})
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-text-muted">{t('parcelSummary.totalArea', 'Area')}</span>
                        <p className="text-base font-heading font-bold text-ink">
                          {parcel.areaSqM.toLocaleString()} m²
                        </p>
                      </div>
                    </div>

                    {/* Pending Verification Notice */}
                    {isPending && (
                      <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                          <span>
                            {t(
                              'myParcels.pendingVerificationNotice',
                              'This parcel was submitted with partial document match and is awaiting Land Records officer approval.'
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setParcelToDelete(parcel)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 font-semibold underline underline-offset-2 shrink-0 inline-flex items-center gap-1 text-[11px]"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t('myParcels.deletePendingLink', 'Delete Submission')}</span>
                        </button>
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gov-border/60">
                      <button
                        onClick={() => navigate(`/parcels/${parcel.id}`)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition underline underline-offset-2"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{t('myParcels.viewDetails360', 'View 360° Cadastral Record')}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {isRegistered ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/citizen/raise-request?parcelId=${parcel.id}`)}
                            className="px-3 py-1.5 rounded-lg bg-brand-900 hover:bg-brand-800 text-white text-xs font-heading font-bold inline-flex items-center gap-1.5 transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{t('myParcels.raiseRequestBtn', 'Raise Complaint / Request')}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setParcelToDelete(parcel)}
                            className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-heading font-semibold border border-red-200 dark:border-red-800/60 inline-flex items-center gap-1.5 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{t('myParcels.deletePendingBtn', 'Delete Pending Submission')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyParcels;
