import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OfficerPortal from './OfficerPortal';
import apiService from '../services/apiService';

vi.mock('../services/apiService', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

function renderPortal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OfficerPortal />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

  it('shows the login form when there is no officer session', () => {
    renderPortal();
    expect(screen.getByText('Officer Login')).toBeInTheDocument();
  });

  it('logging in shows the dashboard with correct stats derived from real workflow data', async () => {
    mockApi();
    renderPortal();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Welcome, Asha (Land Record Officer)')).toBeInTheDocument();
    // Wait for the workflows query to resolve before reading stat cards.
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

  it('requests workflows scoped to the officer\'s own department', async () => {
    mockApi();
    renderPortal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByLabelText('Department / Role'), { target: { value: 'PLANNING_OFFICER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/workflows', { params: { department: 'PLANNING' } }));
  });

  it('selecting a pending workflow shows its review panel', async () => {
    mockApi();
    renderPortal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    fireEvent.click(await screen.findByText('ROR COPY REQUEST'));

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('logging out returns to the login form', async () => {
    mockApi();
    renderPortal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));

    expect(screen.getByText('Officer Login')).toBeInTheDocument();
  });
});
