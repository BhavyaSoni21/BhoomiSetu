import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceRequestForm from './ServiceRequestForm';
import apiService from '../../services/apiService';
import { AuthUser } from '../auth/auth';

vi.mock('../../services/apiService', () => ({
  default: { post: vi.fn() },
}));

const citizen: AuthUser = { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' };
const officer: AuthUser = { id: 'o1', email: 'officer@test.gov.in', name: 'An Officer', role: 'LAND_RECORD_OFFICER' };

// Filing a request now requires a signed-in citizen (POST /workflows is
// @Roles(CITIZEN_ROLE)-guarded) - most of these tests exercise the actual
// filing flow, so they pre-seed the auth-me cache with a citizen the same
// way MyParcels.test.tsx does, unless a test explicitly wants the gate.
function renderWithClient(ui: React.ReactElement, user: AuthUser | null = citizen) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ServiceRequestForm', () => {
  beforeEach(() => {
    vi.mocked(apiService.post).mockReset();
  });

  it('calls onClose without submitting when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(onClose);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('submits with the given parcelId and workflowType, omitting empty optional fields', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { id: 'wf1', parcelId: 'p1', workflowType: 'CORRECTION_REQUEST', currentStatus: 'SUBMITTED', createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '', steps: [] },
    });
    renderWithProviders(vi.fn());

    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/workflows', {
        parcelId: 'p1',
        workflowType: 'CORRECTION_REQUEST',
        createdBy: undefined,
        requestDetails: undefined,
      }),
    );
  });

  it('shows an error message and stays open when the submission fails', async () => {
    vi.mocked(apiService.post).mockRejectedValue(new Error('network error'));
    renderWithProviders(vi.fn());

    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.queryByText('Request Submitted')).not.toBeInTheDocument();
  });

  it('prompts an unauthenticated visitor to sign in instead of showing the form, and never calls /workflows', async () => {
    renderWithProviders(vi.fn(), null);

    expect(await screen.findByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create Account' })).toHaveAttribute('href', '/register');
    expect(screen.queryByRole('button', { name: 'Submit Request' })).not.toBeInTheDocument();
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('prompts a signed-in non-citizen (e.g. an officer) to sign in with a citizen account, without showing the form', async () => {
    renderWithProviders(vi.fn(), officer);

    expect(await screen.findByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Request' })).not.toBeInTheDocument();
    expect(apiService.post).not.toHaveBeenCalled();
  });

  function renderWithProviders(onClose: () => void, user: AuthUser | null = citizen) {
    return renderWithClient(
      <ServiceRequestForm parcelId="p1" workflowType="CORRECTION_REQUEST" title="Report an Issue" onClose={onClose} />,
      user,
    );
  }
});
