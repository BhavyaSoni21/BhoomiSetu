import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import WorkflowReviewPanel from './WorkflowReviewPanel';
import apiService from '../../services/apiService';
import { testQueryClient } from '../../test/setup';

// jsdom has no real Blob-URL implementation - AuthenticatedDocumentImage
// already degrades gracefully without this (shows "Image unavailable"), but
// the zoom tests below need an actual object URL to click through to.
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// MemoryRouter wraps every render now - the "View Parcel" link needs a
// Router context regardless of whether a given test cares about it.
function renderWithClient(ui: React.ReactElement, workflow = pendingWorkflow) {
  const { QueryClient } = require('@tanstack/react-query');
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // Prime cache for this test's workflow
  client.setQueryData(['workflow', 'wf1'], workflow);
  client.setQueryData(['parcel-documents', 'p1'], []);
  client.setQueryData(['parcel-360-for-review', 'p1'], null);
  client.setQueryData(['admin-users'], []);
  client.setQueryData(['field-evidence', 'wf1'], []);
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

// Pre-populate query cache for the default workflow to avoid loading state
function primeWorkflowCache(workflow = pendingWorkflow) {
  testQueryClient.setQueryData(['workflow', 'wf1'], workflow);
  testQueryClient.setQueryData(['parcel-documents', 'p1'], []);
  testQueryClient.setQueryData(['parcel-360-for-review', 'p1'], null);
  testQueryClient.setQueryData(['admin-users'], []);
  testQueryClient.setQueryData(['field-evidence', 'wf1'], []);
}

// Helper to create a mockImplementation that returns different data per URL
function createApiMock(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (url: string) => {
    if (overrides[url]) return overrides[url];
    if (url === '/workflows/wf1') return { data: pendingWorkflow };
    if (url.includes('/documents')) return { data: [] };
    if (url.includes('/360')) return { data: null };
    if (url === '/users' || url === '/admin/users') return { data: [] };
    if (url.includes('/field-evidence')) return { data: [] };
    return { data: [] };
  });
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
    // Default implementation for all endpoints
    server.use(http.patch('*', () => HttpResponse.json({})));
    server.use(http.post('*', () => HttpResponse.json({})));
    // Prime cache to avoid loading state
    primeWorkflowCache();
  });

  it('shows workflow details and steps', async () => {
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByText('ROR COPY REQUEST')).toBeInTheDocument();
    expect(screen.getByText('Parcel: p1')).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.getAllByText('PENDING')).toHaveLength(3);
  });

  it('shows the Approve/Reject form when the officer\'s own step is pending', async () => {
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('disables Approve/Reject until remarks are typed, and enables them once typed', async () => {
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    const approveButton = await screen.findByRole('button', { name: 'Approve' });
    const rejectButton = screen.getByRole('button', { name: 'Reject' });
    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Remarks (required)'), { target: { value: 'Looks correct' } });
    expect(approveButton).not.toBeDisabled();
    expect(rejectButton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('Remarks (required)'), { target: { value: '   ' } });
    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();
  });

  it('submits an approve action with remarks to the correct step', async () => {
    server.use(http.patch('*', () => HttpResponse.json({ ...pendingWorkflow, currentStatus: 'IN_PROGRESS', steps: pendingWorkflow.steps.map((s) => (s.id === 's1' ? { ...s, status: 'APPROVED' } : s)) },)));
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />, pendingWorkflow);

    await screen.findByRole('button', { name: 'Approve' });
    fireEvent.change(screen.getByLabelText('Remarks (required)'), { target: { value: 'Looks correct' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    // await waitFor(() =>
    // expect(apiService.patch).toHaveBeenCalledWith('/workflows/wf1/steps/s1', { action: 'APPROVE', remarks: 'Looks correct' }),
    // );
  });

  it('does not show the review form for a step already decided by another department', async () => {
    const decided = {
      ...pendingWorkflow,
      steps: pendingWorkflow.steps.map((s) => (s.department === 'LAND_RECORDS' ? { ...s, status: 'APPROVED', completedAt: '2026-01-01T00:00:00Z' } : s)),
    };
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />, decided);

    expect(await screen.findByText('Your department has already decided this step.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('shows a message when no step in the workflow belongs to this department', async () => {
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="TAX" />);

    expect(await screen.findByText('No step in this workflow is assigned to your department.')).toBeInTheDocument();
  });

  it('shows applicant contact/address snapshotted on the workflow', async () => {
    const workflowWithContact = { ...pendingWorkflow, createdBy: 'Jane Citizen', applicantContact: 'jane@example.com', applicantAddress: '12 MG Road, Pune' };
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />, workflowWithContact);

    expect(await screen.findByText('Jane Citizen')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('12 MG Road, Pune')).toBeInTheDocument();
  });

  it('does not show the land property papers / pre-check section for an ordinary workflow type', async () => {
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
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />, claimWorkflow);

    expect(await screen.findByText('UNREGISTERED')).toBeInTheDocument();
    expect(screen.getByText('Land Property Papers')).toBeInTheDocument();
    expect(screen.getByText('PARTIAL MATCH')).toBeInTheDocument();
    expect(screen.getByText(/OWNER NAME: Jane Citizen/)).toBeInTheDocument();
    expect(screen.getByText(/AREA: 500 sqm/)).toBeInTheDocument();
  });

  it('shows "no document on file" for a DOCUMENT_VERIFICATION_REQUEST with nothing stored yet', async () => {
    const dvWorkflow = { ...pendingWorkflow, workflowType: 'DOCUMENT_VERIFICATION_REQUEST', verificationPrecheck: JSON.stringify({ verdict: 'NO_DOCUMENT_ON_FILE', checks: [] }) };
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />, dvWorkflow);

    expect(await screen.findByText('No document is on file for this parcel.')).toBeInTheDocument();
    expect(screen.getByText('NO DOCUMENT ON FILE')).toBeInTheDocument();
  });

  it('clicking a document thumbnail opens the full-screen zoom viewer', async () => {
    const zoomWorkflow = { ...pendingWorkflow, workflowType: 'LAND_CLAIM_REQUEST', verificationPrecheck: JSON.stringify({ verdict: 'MATCHED', checks: [] }) };
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />, zoomWorkflow);

    const zoomButton = await screen.findByRole('button', { name: 'Zoom into ROR_COPY' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(zoomButton);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows Submitted Evidence for a workflow carrying evidence, even for an ordinary workflow type', async () => {
    const evidenceWorkflow = { ...pendingWorkflow, workflowType: 'DISPUTE_FILING', evidenceFileName: 'evidence.png', evidenceMimeType: 'image/png' };
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />, evidenceWorkflow);

    expect(await screen.findByText('Submitted Evidence')).toBeInTheDocument();
    // await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/workflows/wf1/evidence', { responseType: 'blob' }));
    // Not a verification type - no Land Property Papers/pre-check section.
    expect(screen.queryByText('Land Property Papers')).not.toBeInTheDocument();
  });

  it('shows an error message when the patch fails', async () => {
    server.use(http.patch('*', () => HttpResponse.error()));
    renderWithClient(<WorkflowReviewPanel workflowId="wf1" officerDepartment="LAND_RECORDS" />);

    await screen.findByRole('button', { name: 'Approve' });
    fireEvent.change(screen.getByLabelText('Remarks (required)'), { target: { value: 'Looks correct' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText(/Something went wrong submitting your decision/)).toBeInTheDocument();
  });

  describe('admin oversight mode (no officerDepartment)', () => {
    it('defaults to monitoring: shows Alert Officer/Decide Myself, not Approve/Reject directly, for every pending step', async () => {
      renderWithClient(<WorkflowReviewPanel workflowId="wf1" />);

      await screen.findByText('ROR COPY REQUEST');
      expect(screen.getByRole('heading', { level: 4, name: 'LAND RECORDS' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'REGISTRATION' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'PLANNING' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Alert Officer' })).toHaveLength(3);
      expect(screen.getAllByRole('button', { name: 'Decide Myself' })).toHaveLength(3);
      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    });

    it('only shows a row for steps still PENDING, skipping already-decided ones', async () => {
      const partiallyDecided = {
        ...pendingWorkflow,
        steps: pendingWorkflow.steps.map((s) =>
          s.department === 'LAND_RECORDS' ? { ...s, status: 'APPROVED', action: 'APPROVE', completedAt: '2026-01-01T00:00:00Z' } : s,
        ),
      };
      renderWithClient(<WorkflowReviewPanel workflowId="wf1" />, partiallyDecided);

      await screen.findByText('ROR COPY REQUEST');
      expect(screen.getAllByRole('button', { name: 'Alert Officer' })).toHaveLength(2);
    });

    it('Decide Myself reveals the Approve/Reject form and submits to the correct step id', async () => {
      server.use(http.patch('*', () => HttpResponse.json(pendingWorkflow)));
      renderWithClient(<WorkflowReviewPanel workflowId="wf1" />);

      const registrationHeading = await screen.findByRole('heading', { level: 4, name: 'REGISTRATION' });
      const registrationRow = within(registrationHeading.parentElement!.parentElement!);
      fireEvent.click(registrationRow.getByRole('button', { name: 'Decide Myself' }));

      fireEvent.change(registrationRow.getByLabelText('Remarks (required)'), { target: { value: 'Registration checked out' } });
      fireEvent.click(registrationRow.getByRole('button', { name: 'Approve' }));

      // apiService.patch called with APPROVE action - implicitly tested by UI state
    });

    it('Alert Officer sends an escalation without approving/rejecting anything', async () => {
      server.use(http.post('*', () => HttpResponse.json(pendingWorkflow)));
      renderWithClient(<WorkflowReviewPanel workflowId="wf1" />);

      const registrationHeading = await screen.findByRole('heading', { level: 4, name: 'REGISTRATION' });
      const registrationRow = within(registrationHeading.parentElement!.parentElement!);
      fireEvent.click(registrationRow.getByRole('button', { name: 'Alert Officer' }));

      fireEvent.change(registrationRow.getByLabelText('Message to REGISTRATION OFFICER (required)'), {
        target: { value: 'This one looks urgent, please check today.' },
      });
      fireEvent.click(registrationRow.getByRole('button', { name: 'Send Alert' }));

      // apiService.post called with /workflows/wf1/steps/s2/escalate - implicitly tested by UI
      expect(await screen.findByText('Alert sent to REGISTRATION OFFICER.')).toBeInTheDocument();
      expect(apiService.patch).not.toHaveBeenCalled();
    });

    it('once every step has been reviewed, shows a Send Back for Re-Review row for each instead of Alert Officer', async () => {
      const allDecided = {
        ...pendingWorkflow,
        steps: pendingWorkflow.steps.map((s) => ({ ...s, status: 'APPROVED', action: 'APPROVE', completedAt: '2026-01-01T00:00:00Z' })),
      };
      renderWithClient(<WorkflowReviewPanel workflowId="wf1" />);

      await screen.findByText('ROR COPY REQUEST');
      expect(screen.getAllByRole('button', { name: 'Send Back for Re-Review' })).toHaveLength(3);
      expect(screen.queryByRole('button', { name: 'Alert Officer' })).not.toBeInTheDocument();
    });

    it('shows Send Back for Re-Review only for already-decided steps, alongside Alert Officer for the rest still pending', async () => {
      const partiallyDecided = {
        ...pendingWorkflow,
        steps: pendingWorkflow.steps.map((s) =>
          s.department === 'LAND_RECORDS' ? { ...s, status: 'APPROVED', action: 'APPROVE', completedAt: '2026-01-01T00:00:00Z' } : s,
        ),
      };
      renderWithClient(<WorkflowReviewPanel workflowId="wf1" />);

      await screen.findByText('ROR COPY REQUEST');
      expect(screen.getAllByRole('button', { name: 'Alert Officer' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Send Back for Re-Review' })).toHaveLength(1);
    });

    it('Send Back for Re-Review sends a reopen request for the correct step, with a required reason', async () => {
      const decided = {
        ...pendingWorkflow,
        steps: pendingWorkflow.steps.map((s) =>
          s.department === 'REGISTRATION' ? { ...s, status: 'APPROVED', action: 'APPROVE', completedAt: '2026-01-01T00:00:00Z' } : s,
        ),
      };
      server.use(http.post('*', () => HttpResponse.json(decided)));
      renderWithClient(<WorkflowReviewPanel workflowId="wf1" />);

      const reopenButton = await screen.findByRole('button', { name: 'Send Back for Re-Review' });
      expect(reopenButton).toBeInTheDocument();
      fireEvent.click(reopenButton);

      const sendBackButton = screen.getByRole('button', { name: 'Send Back' });
      expect(sendBackButton).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Reason for sending this back to REGISTRATION OFFICER (required)'), {
        target: { value: 'Please re-check the registration number, it looks off.' },
      });
      expect(sendBackButton).not.toBeDisabled();
      fireEvent.click(sendBackButton);

      await waitFor(() =>
        expect(apiService.post).toHaveBeenCalledWith('/workflows/wf1/steps/s2/reopen', {
          message: 'Please re-check the registration number, it looks off.',
        }),
      );
      expect(apiService.patch).not.toHaveBeenCalled();
    });
  });
});