import React, { useState } from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, UserPlus, X, Trash2 } from 'lucide-react';
import apiService from '../../services/apiService';
import { ManagedUser } from '../../types/user';
import { useAuthUser } from '../auth/auth';
import { OFFICER_ROLES, ROLE_LABELS, VERIFIER_ROLE } from '../officer/officerAuth';

const ALL_ROLE_LABELS: Record<string, string> = { ...ROLE_LABELS, ADMIN: 'Admin', [VERIFIER_ROLE]: 'Verifier' };
const ALL_ROLES = [...OFFICER_ROLES, 'ADMIN', VERIFIER_ROLE];

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Real user/role management (docs/FEATURE_AUDIT.md §8 item 11 - Tech.md §38)
// on top of the real accounts item 9 built. An admin can't change their own
// role or delete their own account here - the backend enforces this too
// (400), this just avoids offering a control that would only ever fail.
const UserManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useAuthUser();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'LAND_RECORD_OFFICER' });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users = [], isLoading, error } = useQuery<ManagedUser[]>(['admin-users'], async () => {
    const response = await apiService.get('/users');
    return response.data;
  });

  // Every one of these three mutations is also audit-logged server-side
  // (docs/FEATURE_AUDIT.md §8 item 10) - RecentActivity renders that same
  // /audit data elsewhere on this page, so it needs invalidating too or a
  // just-performed action would silently not show up there until reload.
  const invalidateUserData = () => {
    queryClient.invalidateQueries(['admin-users']);
    queryClient.invalidateQueries(['analytics-summary']);
    queryClient.invalidateQueries(['audit-log']);
  };

  const createMutation = useMutation<ManagedUser, Error>(
    async () => {
      const response = await apiService.post('/users', form);
      return response.data;
    },
    {
      onSuccess: () => {
        invalidateUserData();
        setShowAddForm(false);
        setForm({ email: '', password: '', name: '', role: 'LAND_RECORD_OFFICER' });
        setFormError(null);
      },
      onError: (err) => {
        setFormError(
          axios.isAxiosError(err) && err.response?.status === 409
            ? t('adminPortal.userDuplicateError')
            : t('adminPortal.userCreateError'),
        );
      },
    },
  );

  const roleMutation = useMutation<ManagedUser, Error, { id: string; role: string }>(
    async ({ id, role }) => {
      const response = await apiService.patch(`/users/${id}/role`, { role });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-users']);
        queryClient.invalidateQueries(['audit-log']);
      },
    },
  );

  const deleteMutation = useMutation<void, Error, string>(
    async (id) => {
      await apiService.delete(`/users/${id}`);
    },
    { onSuccess: invalidateUserData },
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {t('adminPortal.loadingUsers')}
      </div>
    );
  }
  if (error) return <div className="text-sm font-medium text-ink/60 py-3">{t('adminPortal.errorLoadingUsers')}</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddForm((open) => !open)}
          className="inline-flex items-center gap-2 border-2 border-ink bg-secondary hover:bg-secondary-strong text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />}
          {showAddForm ? t('adminPortal.cancelCta') : t('adminPortal.addUserCta')}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="border-2 border-ink bg-muted/40 p-4 mb-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder={t('adminPortal.namePlaceholder')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
              required
            />
            <input
              type="email"
              placeholder={t('adminPortal.emailPlaceholder')}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
              required
            />
            <input
              type="password"
              placeholder={t('adminPortal.passwordPlaceholder')}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
              minLength={8}
              required
            />
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>{ALL_ROLE_LABELS[role]}</option>
              ))}
            </select>
          </div>
          {formError && <p className="text-xs font-bold text-secondary-strong">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="inline-flex items-center gap-2 border-2 border-ink bg-primary hover:bg-primary-strong text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            {createMutation.isLoading ? t('adminPortal.creatingLabel') : t('adminPortal.createAccountCta')}
          </button>
        </form>
      )}

      <div className="border-2 border-ink divide-y-2 divide-ink bg-surface max-h-[400px] overflow-y-auto">
        {users.map((user) => {
          const isSelf = user.id === currentUser?.id;
          return (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-sm">
              <div>
                <span className="font-bold text-ink">{user.name}</span>
                {isSelf && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest text-ink/40">{t('adminPortal.youSuffix')}</span>}
                <p className="text-xs text-ink/60 mt-0.5">{t('adminPortal.userJoinedLine', { email: user.email, date: formatDate(user.createdAt) })}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={user.role}
                  disabled={isSelf || roleMutation.isLoading}
                  onChange={(e) => roleMutation.mutate({ id: user.id, role: e.target.value })}
                  className="px-2 py-1.5 border-2 border-ink bg-surface text-ink text-xs focus:outline-none focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>{ALL_ROLE_LABELS[role]}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (window.confirm(t('adminPortal.deleteUserConfirm', { name: user.name }))) deleteMutation.mutate(user.id);
                  }}
                  disabled={isSelf || deleteMutation.isLoading}
                  className="inline-flex items-center gap-1.5 border-2 border-ink text-secondary-strong hover:bg-secondary/10 px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('adminPortal.deleteCta')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserManagement;
