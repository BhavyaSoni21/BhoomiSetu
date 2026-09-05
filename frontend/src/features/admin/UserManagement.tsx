import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import apiService from '../../services/apiService';
import { ManagedUser } from '../../types/user';
import { useAuthUser } from '../auth/auth';
import { OFFICER_ROLES, ROLE_LABELS } from '../officer/officerAuth';

const ALL_ROLE_LABELS: Record<string, string> = { ...ROLE_LABELS, ADMIN: 'Admin' };
const ALL_ROLES = [...OFFICER_ROLES, 'ADMIN'];

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Real user/role management (docs/FEATURE_AUDIT.md §8 item 11 - Tech.md §38)
// on top of the real accounts item 9 built. An admin can't change their own
// role or delete their own account here - the backend enforces this too
// (400), this just avoids offering a control that would only ever fail.
const UserManagement: React.FC = () => {
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
            ? 'A user with this email already exists.'
            : 'Something went wrong creating this account. Passwords must be at least 8 characters.',
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

  if (isLoading) return <div className="text-gray-500 text-sm">Loading users...</div>;
  if (error) return <div className="text-gray-500 text-sm">Error loading users</div>;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowAddForm((open) => !open)}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          {showAddForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="border rounded p-3 mb-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
              required
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
              minLength={8}
              required
            />
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>{ALL_ROLE_LABELS[role]}</option>
              ))}
            </select>
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {users.map((user) => {
          const isSelf = user.id === currentUser?.id;
          return (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0 text-sm">
              <div>
                <span className="font-medium text-gray-800">{user.name}</span>
                {isSelf && <span className="ml-1 text-xs text-gray-400">(You)</span>}
                <p className="text-xs text-gray-500">{user.email} · Joined {formatDate(user.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={user.role}
                  disabled={isSelf || roleMutation.isLoading}
                  onChange={(e) => roleMutation.mutate({ id: user.id, role: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50"
                >
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>{ALL_ROLE_LABELS[role]}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${user.name}'s account? This cannot be undone.`)) deleteMutation.mutate(user.id);
                  }}
                  disabled={isSelf || deleteMutation.isLoading}
                  className="px-2 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
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
