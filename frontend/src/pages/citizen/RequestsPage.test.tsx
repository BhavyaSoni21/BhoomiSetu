import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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

  // A decided request's per-department officer remarks (WorkflowStep.remarks,
  // mandatory on every review decision) were already returned by
  // GET /workflows/mine but never rendered - a citizen had no way to see why
  // a request was approved/rejected. Collapsed by default (View Details toggle).
  it('reveals per-department officer remarks, the citizen\'s own request text, and an overall note only once expanded', async () => {
    const decided = {
      id: 'wf3', parcelId: 'p3', workflowType: 'CORRECTION_REQUEST', currentStatus: 'REJECTED',
      createdBy: null, requestDetails: 'My survey number is listed incorrectly.', lastRemarks: 'Escalated to district office.',
      createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '',
      steps: [
        { id: 's4', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'REJECTED', action: 'REJECT', remarks: 'Survey number matches our records; no correction needed.', completedAt: '2026-03-02T00:00:00.000Z' },
      ],
    };
    vi.mocked(apiService.get).mockResolvedValue({ data: [decided] });
    renderPage();
    await screen.findByText('Correction request');

    // Not shown until expanded.
    expect(screen.queryByText(/Survey number matches our records/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    expect(await screen.findByText('My survey number is listed incorrectly.')).toBeInTheDocument();
    expect(screen.getByText(/Survey number matches our records; no correction needed\./)).toBeInTheDocument();
    expect(screen.getByText('Escalated to district office.')).toBeInTheDocument();
  });

  it('shows a "no remarks yet" placeholder for a step still pending review', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [workflowOnParcelOne] });
    renderPage();
    await screen.findByText('Record of Rights (RoR) copy request');

    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    const pendingStep = (await screen.findByText('REGISTRATION')).closest('div')!.parentElement!;
    expect(within(pendingStep).getByText(/No remarks yet/)).toBeInTheDocument();
  });
});
