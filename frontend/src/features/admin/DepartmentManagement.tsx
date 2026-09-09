import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Plus, X, Trash2, Pencil } from 'lucide-react';
import apiService from '../../services/apiService';
import { Department } from '../../types/department';

const emptyForm = { code: '', name: '', description: '', contactEmail: '', contactPhone: '' };
const emptyEditForm = { name: '', description: '', contactEmail: '', contactPhone: '' };

// Admin-editable department directory (docs/FRONTEND_UPGRADE_SPEC.md §7,
// Phase 3's "Departments" piece) - display/admin metadata (name/description/
// contact info) for the department codes already hardcoded elsewhere in the
// app (ROLE_DEPARTMENT, the mock department domain modules). This table
// doesn't feed back into that hardcoded logic (the spec's own "pragmatic
// prototype choice") - editing a department here changes what an admin sees,
// not how workflows/roles route.
const DepartmentManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: departments = [], isLoading, error } = useQuery<Department[]>(['admin-departments'], async () => {
    const response = await apiService.get('/admin/departments');
    return response.data;
  });

  const invalidate = () => {
    queryClient.invalidateQueries(['admin-departments']);
    queryClient.invalidateQueries(['audit-log']);
  };

  const createMutation = useMutation<Department, Error>(
    async () => {
      const response = await apiService.post('/admin/departments', {
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
      });
      return response.data;
    },
    {
      onSuccess: () => {
        invalidate();
        setShowAddForm(false);
        setForm(emptyForm);
        setFormError(null);
      },
      onError: (err) => {
        setFormError(
          axios.isAxiosError(err) && err.response?.status === 409
            ? 'A department with this code already exists.'
            : 'Something went wrong creating this department.',
        );
      },
    },
  );

  const updateMutation = useMutation<Department, Error, { id: string }>(
    async ({ id }) => {
      const response = await apiService.patch(`/admin/departments/${id}`, {
        name: editForm.name,
        description: editForm.description || undefined,
        contactEmail: editForm.contactEmail || undefined,
        contactPhone: editForm.contactPhone || undefined,
      });
      return response.data;
    },
    {
      onSuccess: () => {
        invalidate();
        setEditingId(null);
        setEditError(null);
      },
      onError: () => setEditError('Something went wrong saving this department.'),
    },
  );

  const deleteMutation = useMutation<void, Error, string>(
    async (id) => {
      await apiService.delete(`/admin/departments/${id}`);
    },
    { onSuccess: invalidate },
  );

  const startEdit = (department: Department) => {
    setEditingId(department.id);
    setEditError(null);
    setEditForm({
      name: department.name,
      description: department.description ?? '',
      contactEmail: department.contactEmail ?? '',
      contactPhone: department.contactPhone ?? '',
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const handleSaveEdit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    updateMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-ink/60 py-3">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Loading departments...
      </div>
    );
  }
  if (error) return <div className="text-sm font-medium text-ink/60 py-3">Error loading departments</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAddForm((open) => !open)}
          className="inline-flex items-center gap-2 border-2 border-ink bg-secondary hover:bg-secondary-strong text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
          {showAddForm ? 'Cancel' : 'Add Department'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="border-2 border-ink bg-muted/40 p-4 mb-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Code (e.g. LAND_RECORDS)"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
              required
            />
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
              required
            />
            <input
              type="email"
              placeholder="Contact Email"
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
            />
            <input
              type="text"
              placeholder="Contact Phone"
              value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="px-3 py-2 border-2 border-ink bg-surface text-ink placeholder:text-ink/40 text-sm focus:outline-none focus:border-primary md:col-span-2"
              rows={2}
            />
          </div>
          {formError && <p className="text-xs font-bold text-secondary-strong">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="inline-flex items-center gap-2 border-2 border-ink bg-primary hover:bg-primary-strong text-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider shadow-hard-sm transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Department'}
          </button>
        </form>
      )}

      {departments.length === 0 && <div className="text-sm font-medium text-ink/60 py-3">No departments yet.</div>}

      <div className="border-2 border-ink divide-y-2 divide-ink bg-surface">
        {departments.map((department) => (
          <div key={department.id} className="px-3.5 py-3 text-sm">
            {editingId === department.id ? (
              <form onSubmit={(e) => handleSaveEdit(e, department.id)} className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Contact Email"
                    value={editForm.contactEmail}
                    onChange={(e) => setEditForm((f) => ({ ...f, contactEmail: e.target.value }))}
                    className="px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Contact Phone"
                    value={editForm.contactPhone}
                    onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    className="px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary"
                  />
                  <textarea
                    placeholder="Description"
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    className="px-3 py-2 border-2 border-ink bg-surface text-ink text-sm focus:outline-none focus:border-primary md:col-span-2"
                    rows={2}
                  />
                </div>
                {editError && <p className="text-xs font-bold text-secondary-strong">{editError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={updateMutation.isLoading}
                    className="inline-flex items-center gap-1.5 border-2 border-ink bg-primary hover:bg-primary-strong text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50"
                  >
                    {updateMutation.isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="inline-flex items-center gap-1.5 border-2 border-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink transition hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-ink">{department.name}</span>
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-ink/40">{department.code}</span>
                  {department.description && <p className="text-xs text-ink/60 mt-0.5">{department.description}</p>}
                  {(department.contactEmail || department.contactPhone) && (
                    <p className="text-xs text-ink/50 mt-0.5">
                      {[department.contactEmail, department.contactPhone].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(department)}
                    className="inline-flex items-center gap-1.5 border-2 border-ink text-ink hover:bg-muted px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete the "${department.name}" department?`)) deleteMutation.mutate(department.id);
                    }}
                    disabled={deleteMutation.isLoading}
                    className="inline-flex items-center gap-1.5 border-2 border-ink text-secondary-strong hover:bg-secondary/10 px-2 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DepartmentManagement;
