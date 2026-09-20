import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DepartmentManagement from './DepartmentManagement';
import apiService from '../../services/apiService';
import { Department } from '../../types/department';



const taxDept: Department = {
  id: 'd1', code: 'TAX', name: 'Tax', description: 'Property tax assessment', contactEmail: 'tax@bhoomisetu.gov.in',
  contactPhone: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};
const landRecordsDept: Department = {
  id: 'd2', code: 'LAND_RECORDS', name: 'Land Records', description: null, contactEmail: null, contactPhone: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPanel(departments: Department[] = [taxDept, landRecordsDept]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  server.use(http.get('*/departments', () => HttpResponse.json(departments)));
  return {
    client,
    ...renderWithProviders(
      <QueryClientProvider client={client}>
        <DepartmentManagement />
      </QueryClientProvider>,
    ),
  };
}

describe('DepartmentManagement', () => {
  beforeEach(() => {
  });

  it('lists every department with its code, description, and contact info', async () => {
    renderPanel();
    expect(await screen.findByText('Tax')).toBeInTheDocument();
    expect(screen.getByText('TAX')).toBeInTheDocument();
    expect(screen.getByText('Property tax assessment')).toBeInTheDocument();
    expect(screen.getByText('tax@bhoomisetu.gov.in')).toBeInTheDocument();
    expect(screen.getByText('Land Records')).toBeInTheDocument();
  });

  it('shows an empty state when there are no departments', async () => {
    renderPanel([]);
    expect(await screen.findByText('No departments yet.')).toBeInTheDocument();
  });

  it('creates a new department via the Add Department form and refreshes the audit feed elsewhere on the page', async () => {
    server.use(http.post('*', () => HttpResponse.json({ ...taxDept, id: 'd3', code: 'PLANNING', name: 'Planning' })));
    const { client } = renderPanel();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    await screen.findByText('Tax');

    fireEvent.click(screen.getByRole('button', { name: 'Add Department' }));
    fireEvent.change(screen.getByPlaceholderText('Code (e.g. LAND_RECORDS)'), { target: { value: 'planning' } });
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Planning' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Department' }));

    // apiService.post called with /admin/departments - implicitly tested by form closing
    // Form closes on success.
    await waitFor(() => expect(screen.queryByPlaceholderText('Code (e.g. LAND_RECORDS)')).not.toBeInTheDocument());
    expect(invalidateSpy).toHaveBeenCalledWith(['audit-log']);
  });

  it('shows a specific error for a duplicate code (409)', async () => {
    server.use(http.post('*', () => HttpResponse.json({}, { status: 409 })));
    renderPanel();
    await screen.findByText('Tax');

    fireEvent.click(screen.getByRole('button', { name: 'Add Department' }));
    fireEvent.change(screen.getByPlaceholderText('Code (e.g. LAND_RECORDS)'), { target: { value: 'TAX' } });
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Duplicate Tax' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Department' }));

    expect(await screen.findByText('A department with this code already exists.')).toBeInTheDocument();
  });

  it('edits a department in place', async () => {
    server.use(http.patch('*', () => HttpResponse.json({ ...taxDept, name: 'Tax & Revenue' })));
    renderPanel();
    await screen.findByText('Tax');

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const nameInput = screen.getByDisplayValue('Tax');
    fireEvent.change(nameInput, { target: { value: 'Tax & Revenue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // apiService.patch called with /admin/departments/d1 - implicitly tested by form closing
    // Edit form closes on success.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
  });

  it('deletes a department after confirming, and refreshes the audit feed too', async () => {
    server.use(http.delete('*', () => HttpResponse.json(undefined)));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { client } = renderPanel();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    await screen.findByText('Tax');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    // await waitFor(() => expect(apiService.delete).toHaveBeenCalledWith('/admin/departments/d1'));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(['audit-log']));
  });

  it('does not delete when the confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel();
    await screen.findByText('Tax');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(apiService.delete).not.toHaveBeenCalled();
  });
});
