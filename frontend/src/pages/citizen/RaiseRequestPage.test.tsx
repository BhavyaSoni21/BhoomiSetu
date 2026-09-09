import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RaiseRequestPage from './RaiseRequestPage';
import apiService from '../../services/apiService';
import { AuthUser } from '../../features/auth/auth';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const citizen: AuthUser = { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' };

const parcelOne = { id: 'p1', canonicalParcelId: 'CAN-1', ulpin: 'ULPIN-1', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: '{}' };
const parcelTwo = { id: 'p2', canonicalParcelId: 'CAN-2', ulpin: null, stateCode: 'DL', districtCode: 'NEW', localBodyCode: 'DLLB001', areaSqM: 300, geometry: '{}' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], citizen);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RaiseRequestPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// [new restriction] (docs/FRONTEND_UPGRADE_SPEC.md §4): the parcel selector
// only lists parcels GET /parcels/mine actually returns for this citizen -
// not a free-text parcelId field - and auto-fills read-only details once one
// is picked, before any of the three request-type buttons even appear.
describe('RaiseRequestPage', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.post).mockReset();
  });

  it('shows a no-parcels message and no dropdown when the citizen has no linked parcels', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [], total: 0 } });
    renderPage();

    expect(await screen.findByText(/No parcels are linked to your account/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Select a parcel/)).not.toBeInTheDocument();
  });

  it('lists only the citizen\'s own parcels in the dropdown, with none selected by default', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [parcelOne, parcelTwo], total: 2 } });
    renderPage();

    const select = await screen.findByLabelText(/Select a parcel/);
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: /ULPIN-1/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Parcel #p2/ })).toBeInTheDocument();
    // No request-type action is offered before a parcel is chosen.
    expect(screen.queryByRole('button', { name: 'Request Documents' })).not.toBeInTheDocument();
  });

  it('selecting a parcel auto-fills its read-only details and reveals the request-type actions', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [parcelOne, parcelTwo], total: 2 } });
    renderPage();

    const select = await screen.findByLabelText(/Select a parcel/);
    fireEvent.change(select, { target: { value: 'p1' } });

    expect(screen.getByText('ULPIN: ULPIN-1')).toBeInTheDocument();
    expect(screen.getByText(/MH-PUN-MHLB001/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request Documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report Issue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File a Dispute' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify Documents' })).toBeInTheDocument();
  });

  it('files a Verify Documents request (DOCUMENT_VERIFICATION_REQUEST) against the selected parcel', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [parcelOne, parcelTwo], total: 2 } });
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        id: 'wf2', parcelId: 'p1', workflowType: 'DOCUMENT_VERIFICATION_REQUEST', currentStatus: 'SUBMITTED',
        createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
        steps: [{ id: 's2', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null }],
      },
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText(/Select a parcel/), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify Documents' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit Request' }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/workflows', expect.objectContaining({ parcelId: 'p1', workflowType: 'DOCUMENT_VERIFICATION_REQUEST' })),
    );
  });

  it('files the request against the selected parcel, not any other one', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { parcels: [parcelOne, parcelTwo], total: 2 } });
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        id: 'wf1', parcelId: 'p2', workflowType: 'CORRECTION_REQUEST', currentStatus: 'SUBMITTED',
        createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
        steps: [{ id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null }],
      },
    });
    renderPage();

    fireEvent.change(await screen.findByLabelText(/Select a parcel/), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit Request' }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/workflows', expect.objectContaining({ parcelId: 'p2', workflowType: 'CORRECTION_REQUEST' })),
    );
  });
});
