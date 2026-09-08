import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RequestsPage from './RequestsPage';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RequestsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const workflowOnParcelOne = {
  id: 'wf1', parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST', currentStatus: 'IN_PROGRESS',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '',
  steps: [
    { id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'APPROVED', action: 'APPROVE', remarks: null, completedAt: '2026-01-06T00:00:00.000Z' },
    { id: 's2', stepOrder: 2, department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
  ],
};
const workflowOnParcelTwo = {
  id: 'wf2', parcelId: 'p2', workflowType: 'DISPUTE_FILING', currentStatus: 'REJECTED',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '',
  steps: [{ id: 's3', stepOrder: 1, department: 'DISPUTE', assignedRole: 'DISPUTE_OFFICER', status: 'REJECTED', action: 'REJECT', remarks: null, completedAt: '2026-02-02T00:00:00.000Z' }],
};

// The aggregated cross-parcel Requests page (docs/FRONTEND_UPGRADE_SPEC.md
// §4), backed by the new GET /workflows/mine endpoint - distinct from
// RequestNotifications.tsx, which is scoped to one parcel at a time.
describe('RequestsPage', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
  });

  it('calls GET /workflows/mine, not the per-parcel or officer-scoped endpoints', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderPage();

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/workflows/mine'));
  });

  it('shows an empty state with a link to Raise Request when there are no requests', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderPage();

    expect(await screen.findByText(/haven't filed any service requests/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Raise Request/ })).toHaveAttribute('href', '/citizen/raise-request');
  });

  it('lists every request across every parcel, with its overall status and per-department step status', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [workflowOnParcelOne, workflowOnParcelTwo] });
    renderPage();

    expect(await screen.findByText('Record of Rights (RoR) copy request')).toBeInTheDocument();
    expect(screen.getByText('Dispute filing')).toBeInTheDocument();
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('REJECTED')).toBeInTheDocument();

    // Per-department step status, not just the workflow's overall status.
    expect(screen.getByText('LAND RECORDS: APPROVED')).toBeInTheDocument();
    expect(screen.getByText('REGISTRATION: PENDING')).toBeInTheDocument();
    expect(screen.getByText('DISPUTE: REJECTED')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    vi.mocked(apiService.get).mockRejectedValue(new Error('network error'));
    renderPage();

    expect(await screen.findByText(/Something went wrong loading your requests/)).toBeInTheDocument();
  });
});
