import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Pencil } from 'lucide-react';
import { useUpdateProfileDetails, AuthUser } from './auth';

export interface ProfileDetailsCardProps {
  user: AuthUser;
}

// Profile "more info, editable" (docs/FRONTEND_UPGRADE_SPEC.md follow-up) -
// no OTP step, unlike ContactMethodCard (name/address/governmentIdNumber/
// occupation aren't identity-verification critical). Originally Citizen
// Profile-only (ProfilePage.tsx); extracted 2026-09-10 so Officer Profile
// (OfficerProfilePage.tsx) can reuse it verbatim - POST /auth/profile/details
// is role-agnostic on the backend, only the controller's @Roles guard needed
// widening past CITIZEN_ROLE. For citizens these are also the fields the
// simplified Raise Request flow auto-fills onto a workflow server-side
// (workflows.controller.ts's create()); for an officer they're just their
// own account info, with no such auto-fill consumer.
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

export default ProfileDetailsCard;
