import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceRequestForm from './ServiceRequestForm';
import apiService from '../../services/apiService';
import { AuthUser } from '../auth/auth';

vi.mock('../../services/apiService', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

function makeFile(name = 'document.png') {
  return new File(['fake-image-bytes'], name, { type: 'image/png' });
}

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
    vi.mocked(apiService.get).mockReset();
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

  describe('DOCUMENT_VERIFICATION_REQUEST (conditional upload)', () => {
    it('shows no upload field and submits as JSON when the parcel already has a document on file', async () => {
      vi.mocked(apiService.get).mockResolvedValue({ data: [{ id: 'd1', parcelId: 'p1', documentType: 'ROR_COPY', mimeType: 'image/png', registrationStatus: 'REGISTERED', createdAt: '' }] });
      vi.mocked(apiService.post).mockResolvedValue({
        data: { id: 'wf1', parcelId: 'p1', workflowType: 'DOCUMENT_VERIFICATION_REQUEST', currentStatus: 'SUBMITTED', createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '', steps: [] },
      });
      renderWithClient(<ServiceRequestForm parcelId="p1" workflowType="DOCUMENT_VERIFICATION_REQUEST" title="Verify Documents" onClose={vi.fn()} />);

      await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/parcels/p1/documents'));
      expect(screen.queryByLabelText('Upload Your Papers')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
      await waitFor(() =>
        expect(apiService.post).toHaveBeenCalledWith('/workflows', expect.objectContaining({ parcelId: 'p1', workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })),
      );
    });

    it('requires an upload and submits multipart when the parcel has no document on file', async () => {
      vi.mocked(apiService.get).mockResolvedValue({ data: [] });
      vi.mocked(apiService.post).mockResolvedValue({
        data: { id: 'wf1', parcelId: 'p1', workflowType: 'DOCUMENT_VERIFICATION_REQUEST', currentStatus: 'SUBMITTED', createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '', steps: [] },
      });
      renderWithClient(<ServiceRequestForm parcelId="p1" workflowType="DOCUMENT_VERIFICATION_REQUEST" title="Verify Documents" onClose={vi.fn()} />);

      expect(await screen.findByText(/No papers are on file/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit Request' })).toBeDisabled();
      const fileInput = document.getElementById('documentUploadInput') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [makeFile()] } });

      expect(screen.getByRole('button', { name: 'Submit Request' })).not.toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
      await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/workflows', expect.any(FormData), { headers: { 'Content-Type': undefined } }));
      const formData = vi.mocked(apiService.post).mock.calls[0][1] as FormData;
      expect(formData.get('workflowType')).toBe('DOCUMENT_VERIFICATION_REQUEST');
      expect(formData.get('document')).toBeInstanceOf(File);
    });
  });

  describe('DISPUTE_FILING (optional evidence)', () => {
    it('shows an always-optional evidence upload field, pre-filled from initialFile', async () => {
      renderWithClient(
        <ServiceRequestForm parcelId="p1" workflowType="DISPUTE_FILING" title="File a Dispute" onClose={vi.fn()} initialFile={makeFile('evidence.png')} />,
      );

      expect(screen.getByText('evidence.png')).toBeInTheDocument();
      const fileInput = document.getElementById('documentUploadInput') as HTMLInputElement;
      expect(fileInput).not.toBeRequired();
    });

    it('submits as JSON when no evidence file is attached', async () => {
      vi.mocked(apiService.post).mockResolvedValue({
        data: { id: 'wf1', parcelId: 'p1', workflowType: 'DISPUTE_FILING', currentStatus: 'SUBMITTED', createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '', steps: [] },
      });
      renderWithClient(<ServiceRequestForm parcelId="p1" workflowType="DISPUTE_FILING" title="File a Dispute" onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
      await waitFor(() =>
        expect(apiService.post).toHaveBeenCalledWith('/workflows', expect.objectContaining({ parcelId: 'p1', workflowType: 'DISPUTE_FILING' })),
      );
    });
  });

  describe('409 conflict handling', () => {
    it("shows the server's message and a File a Dispute Instead button when onConflict is provided", async () => {
      vi.mocked(apiService.post).mockRejectedValue({
        isAxiosError: true,
        response: { status: 409, data: { message: 'This parcel is already linked to another account.' } },
      });
      const onConflict = vi.fn();
      renderWithClient(
        <ServiceRequestForm parcelId="p1" workflowType="LAND_CLAIM_REQUEST" title="Claim This Parcel" onClose={vi.fn()} initialFile={makeFile()} onConflict={onConflict} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

      expect(await screen.findByText('This parcel is already linked to another account.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'File a Dispute Instead' }));
      expect(onConflict).toHaveBeenCalled();
    });

    it('falls back to the generic error message when onConflict is not provided', async () => {
      vi.mocked(apiService.post).mockRejectedValue({
        isAxiosError: true,
        response: { status: 409, data: { message: 'Conflict.' } },
      });
      renderWithClient(<ServiceRequestForm parcelId="p1" workflowType="LAND_CLAIM_REQUEST" title="Claim This Parcel" onClose={vi.fn()} initialFile={makeFile()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

      expect(await screen.findByText('Conflict.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'File a Dispute Instead' })).not.toBeInTheDocument();
    });
  });
});
