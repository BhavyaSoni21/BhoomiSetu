import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import axios from 'axios';
import { Pencil } from 'lucide-react';
import { useUpdateProfileDetails, AuthUser } from './auth';

export interface ProfileDetailsCardProps {
  user: AuthUser;
}

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
      : t('citizenPortal.profileContactUpdateError', 'Failed to update details. Please try again.'));

  if (editing) {
    return (
      <div className="bg-white dark:bg-surface-1 border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h2 className="text-base sm:text-lg font-bold font-heading text-text-heading mb-3">
          {t('citizenPortal.profileDetailsHeading', 'Profile Details')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="profileNameInput" className="block text-xs font-semibold text-text-heading mb-1">
              {t('citizenPortal.profileNameLabel', 'Full Name')}
            </label>
            <input
              id="profileNameInput"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-[var(--border)] bg-white dark:bg-surface-1 rounded-xl px-3.5 py-2 text-text-primary text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label htmlFor="profileAddressInput" className="block text-xs font-semibold text-text-heading mb-1">
              {t('citizenPortal.profileAddressLabel', 'Residential Address')}
            </label>
            <input
              id="profileAddressInput"
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full border border-[var(--border)] bg-white dark:bg-surface-1 rounded-xl px-3.5 py-2 text-text-primary text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label htmlFor="profileGovernmentIdInput" className="block text-xs font-semibold text-text-heading mb-1">
              {t('citizenPortal.profileGovernmentIdLabel', 'Government ID')}
            </label>
            <input
              id="profileGovernmentIdInput"
              type="text"
              value={form.governmentIdNumber}
              onChange={(e) => setForm((f) => ({ ...f, governmentIdNumber: e.target.value }))}
              className="w-full border border-[var(--border)] bg-white dark:bg-surface-1 rounded-xl px-3.5 py-2 text-text-primary text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label htmlFor="profileOccupationInput" className="block text-xs font-semibold text-text-heading mb-1">
              {t('citizenPortal.profileOccupationLabel', 'Occupation')}
            </label>
            <input
              id="profileOccupationInput"
              type="text"
              value={form.occupation}
              onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
              className="w-full border border-[var(--border)] bg-white dark:bg-surface-1 rounded-xl px-3.5 py-2 text-text-primary text-sm focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          {errorMessage && <p className="text-xs font-medium text-rose-600">{errorMessage}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={updateDetailsMutation.isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F3D2E] hover:bg-[#166534] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs transition disabled:opacity-50"
            >
              {updateDetailsMutation.isLoading ? '...' : t('citizenPortal.profileSaveCta', 'Save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-1 text-text-heading font-bold uppercase text-xs tracking-wider hover:bg-surface-2 transition"
            >
              {t('citizenPortal.profileCancelCta', 'Cancel')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-1 border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.09)] transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="text-base sm:text-lg font-bold font-heading text-text-heading">
          {t('citizenPortal.profileDetailsHeading', 'Profile Details')}
        </h2>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-1 text-text-heading font-semibold text-xs uppercase tracking-wider hover:bg-surface-2 transition shadow-xs"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('citizenPortal.profileEditCta', 'Edit')}</span>
        </button>
      </div>
      <p className="text-xs text-text-muted mb-4">{t('citizenPortal.profileDetailsDesc', 'Your official registered profile details.')}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-2.5 rounded-xl bg-surface-2 dark:bg-surface-2/60">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t('citizenPortal.profileNameLabel', 'Full Name')}</dt>
          <dd className="text-sm font-semibold text-text-heading mt-0.5">{user.name}</dd>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-2 dark:bg-surface-2/60">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t('citizenPortal.profileAddressLabel', 'Residential Address')}</dt>
          <dd className="text-sm font-medium text-text-heading mt-0.5">{user.address || t('citizenPortal.profileNotProvided', 'Not provided')}</dd>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-2 dark:bg-surface-2/60">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t('citizenPortal.profileGovernmentIdLabel', 'Government ID')}</dt>
          <dd className="text-sm font-medium text-text-heading mt-0.5">{user.governmentIdNumber || t('citizenPortal.profileNotProvided', 'Not provided')}</dd>
        </div>
        <div className="p-2.5 rounded-xl bg-surface-2 dark:bg-surface-2/60">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{t('citizenPortal.profileOccupationLabel', 'Occupation')}</dt>
          <dd className="text-sm font-medium text-text-heading mt-0.5">{user.occupation || t('citizenPortal.profileNotProvided', 'Not provided')}</dd>
        </div>
      </dl>
    </div>
  );
};

export default ProfileDetailsCard;
