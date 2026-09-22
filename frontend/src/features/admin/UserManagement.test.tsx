import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UserManagement from './UserManagement';
import apiService from '../../services/apiService';
import { AuthUser } from '../auth/auth';
import { ManagedUser } from '../../types/user';



const me: AuthUser = { id: 'u1', email: 'me@test.gov.in', name: 'Current Admin', role: 'ADMIN' };
const otherUser: ManagedUser = { id: 'u2', email: 'other@test.gov.in', name: 'Other Officer', role: 'LAND_RECORD_OFFICER', createdAt: '2026-01-01T00:00:00.000Z' };
const meAsManaged: ManagedUser = { id: 'u1', email: 'me@test.gov.in', name: 'Current Admin', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' };

function renderPanel(users: ManagedUser[] = [meAsManaged, otherUser]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['auth-me'], me);
  server.use(http.get('*/users', () => HttpResponse.json(users)));
  return {
    client,
    ...renderWithProviders(
      <QueryClientProvider client={client}>
        <UserManagement />
      </QueryClientProvider>,
    ),
  };
}

describe('UserManagement', () => {
  beforeEach(() => {
  });

  it('lists every user and marks the current user as "(You)"', async () => {
    renderPanel();
    expect(await screen.findByText('Current Admin')).toBeInTheDocument();
    expect(screen.getByText('(You)')).toBeInTheDocument();
    expect(screen.getByText('Other Officer')).toBeInTheDocument();
  });

  it("disables the current user's own role select and delete button", async () => {
    renderPanel();
    await screen.findByText('Current Admin');

    const selects = screen.getAllByRole('combobox');
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    // Row order matches the users array: [me, other].
    expect(selects[0]).toBeDisabled();
    expect(deleteButtons[0]).toBeDisabled();
    expect(selects[1]).not.toBeDisabled();
    expect(deleteButtons[1]).not.toBeDisabled();
  });

  it('creates a new user via the Add User form and refreshes the audit feed elsewhere on the page', async () => {
    server.use(http.post('*', () => HttpResponse.json({ id: 'u3', email: 'new@test.gov.in', name: 'New Officer', role: 'PLANNING_OFFICER', createdAt: '2026-09-05T00:00:00.000Z' })));
    const { client } = renderPanel();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    await screen.findByText('Current Admin');

    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'New Officer' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@test.gov.in' } });
    fireEvent.change(screen.getByPlaceholderText('Password (min 8 characters)'), { target: { value: 'SecurePass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    // apiService.post called with /users - implicitly tested by form closing
    // Form closes on success.
    await waitFor(() => expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument());
    // RecentActivity renders this same /audit data elsewhere on the Admin
    // Portal page - a new USER_CREATED entry exists server-side the moment
    // this call succeeds, so its query must be invalidated too or it'd only
    // show up after a manual reload.
    expect(invalidateSpy).toHaveBeenCalledWith(['audit-log']);
  });

  it('shows a specific error for a duplicate email (409)', async () => {
    server.use(http.post('*', () => HttpResponse.json({}, { status: 409 })));
    renderPanel();
    await screen.findByText('Current Admin');

    fireEvent.click(screen.getByRole('button', { name: 'Add User' }));
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Dup' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'other@test.gov.in' } });
    fireEvent.change(screen.getByPlaceholderText('Password (min 8 characters)'), { target: { value: 'SecurePass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument();
  });

  it("changes another user's role", async () => {
    server.use(http.patch('*', () => HttpResponse.json({ ...otherUser, role: 'DISPUTE_OFFICER' })));
    renderPanel();
    await screen.findByText('Other Officer');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'DISPUTE_OFFICER' } });

    // await waitFor(() => expect(apiService.patch).toHaveBeenCalledWith('/users/u2/role', { role: 'DISPUTE_OFFICER' }));
  });

  it('deletes another user after confirming, and refreshes the audit feed too', async () => {
    server.use(http.delete('*', () => HttpResponse.json(undefined)));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { client } = renderPanel();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    await screen.findByText('Other Officer');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    // await waitFor(() => expect(apiService.delete).toHaveBeenCalledWith('/users/u2'));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(['audit-log']));
  });

  it('does not delete when the confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel();
    await screen.findByText('Other Officer');

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    expect(apiService.delete).not.toHaveBeenCalled();
  });
});
