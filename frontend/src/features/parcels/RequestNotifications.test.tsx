import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RequestNotifications from './RequestNotifications';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RequestNotifications parcelId="p1" />
    </QueryClientProvider>,
  );
}

const submittedWorkflow = {
  id: 'wf-1', parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST', currentStatus: 'SUBMITTED',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z',
  steps: [
    { id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
  ],
};

const rejectedWorkflow = {
  id: 'wf-2', parcelId: 'p1', workflowType: 'DISPUTE_FILING', currentStatus: 'REJECTED',
  createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-02T11:00:00.000Z',
  steps: [
    { id: 's2', stepOrder: 1, department: 'DISPUTE', assignedRole: 'DISPUTE_OFFICER', status: 'REJECTED', action: 'REJECT', remarks: 'Insufficient evidence of ownership.', completedAt: '2026-09-02T11:00:00.000Z' },
  ],
};

describe('RequestNotifications', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
  });

  it('renders nothing once loaded when there are no requests', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    const { container } = renderPanel();
    await waitFor(() => expect(apiService.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the request is still in flight', () => {
    vi.mocked(apiService.get).mockImplementation(() => new Promise(() => {})); // never resolves
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a plain-language status message for a pending request', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [submittedWorkflow] });
    renderPanel();

    expect(await screen.findByText(/Record of Rights \(RoR\) copy request/)).toBeInTheDocument();
    expect(screen.getByText(/has been submitted and is awaiting review/)).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.getByText(/Reference: wf-1/)).toBeInTheDocument();
  });

  it('shows the rejecting department and remarks for a rejected request', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [rejectedWorkflow] });
    renderPanel();

    expect(await screen.findByText(/dispute filing/)).toBeInTheDocument();
    expect(screen.getByText(/has been rejected/)).toBeInTheDocument();
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
    expect(screen.getByText(/Reason \(DISPUTE\): Insufficient evidence of ownership\./)).toBeInTheDocument();
  });

  it('fetches from the parcel-scoped workflows endpoint', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderPanel();
    expect(apiService.get).toHaveBeenCalledWith('/parcels/p1/workflows');
  });
});
