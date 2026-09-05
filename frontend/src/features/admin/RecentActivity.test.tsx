import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecentActivity from './RecentActivity';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RecentActivity />
    </QueryClientProvider>,
  );
}

describe('RecentActivity', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
  });

  it('shows an empty-state message when there is no activity', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderPanel();
    expect(await screen.findByText('No activity recorded yet.')).toBeInTheDocument();
  });

  it('renders a plain-language line per audit entry, including the parcel when present', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: [
        { id: 'a1', userId: 'u1', userRole: 'LAND_RECORD_OFFICER', action: 'WORKFLOW_STEP_APPROVED', entityType: 'WORKFLOW_STEP', entityId: 's1', parcelId: 'p1234567-aaaa', metadata: null, createdAt: '2026-09-05T10:00:00.000Z' },
        { id: 'a2', userId: 'u2', userRole: 'ADMIN', action: 'AUTH_LOGIN', entityType: 'USER', entityId: 'u2', parcelId: null, metadata: null, createdAt: '2026-09-05T09:00:00.000Z' },
      ],
    });
    renderPanel();

    expect(await screen.findByText(/approved a workflow step/)).toBeInTheDocument();
    expect(screen.getByText(/on parcel p1234567/)).toBeInTheDocument();
    expect(screen.getByText(/logged in/)).toBeInTheDocument();
  });

  it('falls back to a humanized raw action name for an unrecognized action', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: [{ id: 'a3', userId: 'u1', userRole: 'ADMIN', action: 'SOME_NEW_ACTION', entityType: 'X', entityId: null, parcelId: null, metadata: null, createdAt: '2026-09-05T10:00:00.000Z' }],
    });
    renderPanel();
    expect(await screen.findByText(/some new action/)).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    vi.mocked(apiService.get).mockRejectedValue(new Error('network error'));
    renderPanel();
    expect(await screen.findByText('Error loading activity')).toBeInTheDocument();
  });
});
