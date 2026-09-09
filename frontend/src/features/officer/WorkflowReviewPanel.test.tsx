import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkflowReviewPanel from './WorkflowReviewPanel';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

// jsdom has no real Blob-URL implementation - AuthenticatedDocumentImage
// already degrades gracefully without this (shows "Image unavailable"), but
// the zoom tests below need an actual object URL to click through to.
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const pendingWorkflow = {
  id: 'wf1',
  parcelId: 'p1',
  workflowType: 'ROR_COPY_REQUEST',
  currentStatus: 'SUBMITTED',
  createdBy: null,
  requestDetails: 'Need it urgently',
  lastRemarks: null,
  createdAt: '',
  updatedAt: '',
  steps: [
    { id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's2', stepOrder: 2, department: 'REGISTRATION', assignedRole: 'REGISTRATION_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
    { id: 's3', stepOrder: 3, department: 'PLANNING', assignedRole: 'PLANNING_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null },
  ],
};

describe('WorkflowReviewPanel', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.patch).mockReset();
  });

  it('shows workflow details and steps', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: pendingWorkflow });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByText('ROR COPY REQUEST')).toBeInTheDocument();
    expect(screen.getByText('Parcel: p1')).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.getAllByText('PENDING')).toHaveLength(3);
  });

  it('shows the Approve/Reject form when the officer\'s own step is pending', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: pendingWorkflow });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('submits an approve action with remarks to the correct step', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: pendingWorkflow });
    vi.mocked(apiService.patch).mockResolvedValue({
      data: { ...pendingWorkflow, currentStatus: 'IN_PROGRESS', steps: pendingWorkflow.steps.map((s) => (s.id === 's1' ? { ...s, status: 'APPROVED' } : s)) },
    });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    await screen.findByRole('button', { name: 'Approve' });
    fireEvent.change(screen.getByLabelText('Remarks (optional)'), { target: { value: 'Looks correct' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(apiService.patch).toHaveBeenCalledWith('/workflows/wf1/steps/s1', { action: 'APPROVE', remarks: 'Looks correct' }),
    );
  });

  it('does not show the review form for a step already decided by another department', async () => {
    const decided = {
      ...pendingWorkflow,
      steps: pendingWorkflow.steps.map((s) => (s.department === 'LAND_RECORDS' ? { ...s, status: 'APPROVED', completedAt: '2026-01-01T00:00:00Z' } : s)),
    };
    vi.mocked(apiService.get).mockResolvedValue({ data: decided });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByText('Your department has already decided this step.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('shows a message when no step in the workflow belongs to this department', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: pendingWorkflow });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="TAX" />);

    expect(await screen.findByText('No step in this workflow is assigned to your department.')).toBeInTheDocument();
  });

  it('shows applicant contact/address snapshotted on the workflow', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { ...pendingWorkflow, createdBy: 'Jane Citizen', applicantContact: 'jane@example.com', applicantAddress: '12 MG Road, Pune' },
    });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByText('Jane Citizen')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('12 MG Road, Pune')).toBeInTheDocument();
  });

  it('does not show the land property papers / pre-check section for an ordinary workflow type', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: pendingWorkflow });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    await screen.findByText('ROR COPY REQUEST');
    expect(screen.queryByText('Land Property Papers')).not.toBeInTheDocument();
  });

  it('shows the stored document + OCR pre-check for a LAND_CLAIM_REQUEST', async () => {
    const claimWorkflow = {
      ...pendingWorkflow,
      workflowType: 'LAND_CLAIM_REQUEST',
      verificationPrecheck: JSON.stringify({
        verdict: 'PARTIAL_MATCH',
        checks: [
          { field: 'OWNER_NAME', expectedValue: 'Jane Citizen', status: 'MATCHED' },
          { field: 'AREA', expectedValue: '500 sqm', status: 'MISMATCH' },
        ],
      }),
    };
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url.includes('/documents')) {
        return { data: [{ id: 'd1', parcelId: 'p1', documentType: 'ROR_COPY', fileName: 'p1.png', mimeType: 'image/png', registrationStatus: 'UNREGISTERED', createdAt: '' }] };
      }
      return { data: claimWorkflow };
    });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByText('UNREGISTERED')).toBeInTheDocument();
    expect(screen.getByText('Land Property Papers')).toBeInTheDocument();
    expect(screen.getByText('PARTIAL MATCH')).toBeInTheDocument();
    expect(screen.getByText(/OWNER NAME: Jane Citizen/)).toBeInTheDocument();
    expect(screen.getByText(/AREA: 500 sqm/)).toBeInTheDocument();
  });

  it('shows "no document on file" for a DOCUMENT_VERIFICATION_REQUEST with nothing stored yet', async () => {
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url.includes('/documents')) return { data: [] };
      return { data: { ...pendingWorkflow, workflowType: 'DOCUMENT_VERIFICATION_REQUEST', verificationPrecheck: JSON.stringify({ verdict: 'NO_DOCUMENT_ON_FILE', checks: [] }) } };
    });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByText('No document is on file for this parcel.')).toBeInTheDocument();
    expect(screen.getByText('NO DOCUMENT ON FILE')).toBeInTheDocument();
  });

  it('clicking a document thumbnail opens the full-screen zoom viewer', async () => {
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url.includes('/documents')) {
        return { data: [{ id: 'd1', parcelId: 'p1', documentType: 'ROR_COPY', fileName: 'p1.png', mimeType: 'image/png', registrationStatus: 'REGISTERED', createdAt: '' }] };
      }
      return { data: { ...pendingWorkflow, workflowType: 'LAND_CLAIM_REQUEST', verificationPrecheck: JSON.stringify({ verdict: 'MATCHED', checks: [] }) } };
    });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    const zoomButton = await screen.findByRole('button', { name: 'Zoom into ROR_COPY' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(zoomButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows Submitted Evidence for a workflow carrying evidence, even for an ordinary workflow type', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { ...pendingWorkflow, workflowType: 'DISPUTE_FILING', evidenceFileName: 'evidence.png', evidenceMimeType: 'image/png' },
    });
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByText('Submitted Evidence')).toBeInTheDocument();
    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/workflows/wf1/evidence', { responseType: 'blob' }));
    // Not a verification type - no Land Property Papers/pre-check section.
    expect(screen.queryByText('Land Property Papers')).not.toBeInTheDocument();
  });

  it('shows an error message when the patch fails', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: pendingWorkflow });
    vi.mocked(apiService.patch).mockRejectedValue(new Error('network error'));
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    await screen.findByRole('button', { name: 'Approve' });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText(/Something went wrong submitting your decision/)).toBeInTheDocument();
  });
});
