import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OfficerPortal from './OfficerPortal';
import apiService from '../services/apiService';
import { AuthUser } from '../features/auth/auth';

vi.mock('../services/apiService', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

const landRecordOfficer: AuthUser = { id: 'u1', email: 'lr@test.gov.in', name: 'Asha', role: 'LAND_RECORD_OFFICER' };
const planningOfficer: AuthUser = { id: 'u2', email: 'planning@test.gov.in', name: 'Priya', role: 'PLANNING_OFFICER' };

// OfficerPortal assumes route-level RequireAuth already resolved a session
// (see App.tsx) - tests seed the shared auth-me query cache directly rather
// than mocking a network round trip for something that isn't this
// component's own concern.
function renderPortal(user: AuthUser | null = landRecordOfficer) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <OfficerPortal />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

const today = new Date().toISOString();

const pendingWorkflow = {
  id: 'wf-pending', parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST', currentStatus: 'SUBMITTED',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
  steps: [
    { id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's2', stepOrder: 2, department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's3', stepOrder: 3, department: 'PLANNING', assignedRole: 'PLANNING_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
  ],
};

const decidedWorkflow = {
  id: 'wf-decided', parcelId: 'p2', workflowType: 'CORRECTION_REQUEST', currentStatus: 'IN_PROGRESS',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
  steps: [
    { id: 's4', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'APPROVED', action: 'APPROVE', remarks: null, completedAt: today },
    { id: 's5', stepOrder: 2, department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's6', stepOrder: 3, department: 'PLANNING', assignedRole: 'PLANNING_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
  ],
};

function mockApi() {
  vi.mocked(apiService.get).mockImplementation(async (url: string) => {
    if (url === '/workflows') return { data: [pendingWorkflow, decidedWorkflow] };
    if (url === '/workflows/wf-pending') return { data: pendingWorkflow };
    if (url === '/governance-alerts') return { data: [] };
    throw new Error(`unexpected url: ${url}`);
  });
}

describe('OfficerPortal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.patch).mockReset();
  });

  it('renders nothing when there is no authenticated user (RequireAuth should have redirected before this ever happens)', () => {
    renderPortal(null);
    expect(screen.queryByText('Officer Portal')).not.toBeInTheDocument();
  });

  it('shows the dashboard with correct stats derived from real workflow data', async () => {
    mockApi();
    renderPortal();

    expect(await screen.findByText('Welcome, Asha (Land Record Officer)')).toBeInTheDocument();
    await screen.findByText('ROR COPY REQUEST');

    // Only wf-pending has a PENDING LAND_RECORDS step.
    const pendingCard = screen.getByText('Pending Workflows').closest('div')!;
    expect(within(pendingCard).getByText('1')).toBeInTheDocument();
    // wf-decided's LAND_RECORDS step was completed today.
    const verifiedCard = screen.getByText('Verified Today').closest('div')!;
    expect(within(verifiedCard).getByText('1')).toBeInTheDocument();
    const processedCard = screen.getByText('Documents Processed').closest('div')!;
    expect(within(processedCard).getByText('1')).toBeInTheDocument();
  });

  it("requests workflows scoped to the officer's own department", async () => {
    mockApi();
    renderPortal(planningOfficer);

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/workflows', { params: { department: 'PLANNING' } }));
    expect(await screen.findByText('Welcome, Priya (Planning Officer)')).toBeInTheDocument();
  });

  it('selecting a pending workflow shows its review panel', async () => {
    mockApi();
    renderPortal();

    fireEvent.click(await screen.findByText('ROR COPY REQUEST'));

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('logging out clears the shared session and the portal renders nothing', async () => {
    mockApi();
    const { client } = renderPortal();

    expect(await screen.findByText('Welcome, Asha (Land Record Officer)')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(client.getQueryData(['auth-me'])).toBeNull();
    await waitFor(() => expect(screen.queryByText('Officer Portal')).not.toBeInTheDocument());
  });
});
