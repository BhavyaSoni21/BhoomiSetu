import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceRequestForm from './ServiceRequestForm';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { post: vi.fn() },
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ServiceRequestForm', () => {
  beforeEach(() => {
    vi.mocked(apiService.post).mockReset();
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
        createdBy: undefined,
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

  function renderWithProviders(onClose: () => void) {
    return renderWithClient(
      <ServiceRequestForm parcelId="p1" workflowType="CORRECTION_REQUEST" title="Report an Issue" onClose={onClose} />,
    );
  }
});
