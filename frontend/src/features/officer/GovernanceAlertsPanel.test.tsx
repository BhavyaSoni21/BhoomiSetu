import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GovernanceAlertsPanel from './GovernanceAlertsPanel';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GovernanceAlertsPanel />
    </QueryClientProvider>,
  );
}

const alerts = [
  {
    id: 'a1', parcelId: 'p1', alertType: 'UNAUTHORIZED_CHANGE_DETECTED', severity: 'HIGH',
    source: 'CHANGE_DETECTION', status: 'OPEN', explanation: 'New construction footprint detected.', createdAt: '',
  },
  {
    id: 'a2', parcelId: 'p2', alertType: 'RESTRICTION_ZONE_OVERLAP', severity: 'MEDIUM',
    source: 'RESTRICTION_MONITOR', status: 'OPEN', explanation: 'Parcel intersects the flood zone.', createdAt: '',
  },
];

describe('GovernanceAlertsPanel', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.patch).mockReset();
    vi.mocked(apiService.post).mockReset();
  });

  it('requests only OPEN alerts', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderWithClient();

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/governance-alerts', { params: { status: 'OPEN' } }));
  });

  it('renders each alert with severity, type, parcel, and explanation', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    renderWithClient();

    expect(await screen.findByText('UNAUTHORIZED CHANGE DETECTED')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('Parcel: p1')).toBeInTheDocument();
    expect(screen.getByText('New construction footprint detected.')).toBeInTheDocument();
    expect(screen.getByText('RESTRICTION ZONE OVERLAP')).toBeInTheDocument();
  });

  it('shows an empty state when there are no open alerts', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: [] });
    renderWithClient();

    expect(await screen.findByText('No open governance alerts requiring attention.')).toBeInTheDocument();
  });

  it('dismissing an alert PATCHes its status', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    vi.mocked(apiService.patch).mockResolvedValue({ data: { ...alerts[0], status: 'DISMISSED' } });
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    await waitFor(() => expect(apiService.patch).toHaveBeenCalledWith('/governance-alerts/a1/status', { status: 'DISMISSED' }));
  });

  it('marking an alert reviewed PATCHes its status', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    vi.mocked(apiService.patch).mockResolvedValue({ data: { ...alerts[1], status: 'REVIEWED' } });
    renderWithClient();

    await screen.findByText('RESTRICTION ZONE OVERLAP');
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark Reviewed' })[1]);

    await waitFor(() => expect(apiService.patch).toHaveBeenCalledWith('/governance-alerts/a2/status', { status: 'REVIEWED' }));
  });

  it('"View Details" opens a popout with the full alert detail', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('CHANGE DETECTION')).toBeInTheDocument(); // source
    expect(within(dialog).getByText('OPEN')).toBeInTheDocument(); // status
    expect(within(dialog).getByRole('button', { name: 'Explain with AI' })).toBeInTheDocument();
  });

  it('"Close" dismisses the popout', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explaining an alert from inside the popout posts to its explain endpoint and shows the result', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    vi.mocked(apiService.post).mockResolvedValue({
      data: { summary: 'Flood zone overlap confirmed.', risk_level: 'MEDIUM', findings: [], recommended_action: 'Review before approval.' },
    });
    renderWithClient();

    await screen.findByText('RESTRICTION ZONE OVERLAP');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));

    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/ai/alerts/a2/explain'));
    expect(await screen.findByText('Flood zone overlap confirmed.')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM RISK')).toBeInTheDocument();
  });

  it('shows an error message in the popout when explaining an alert fails', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    vi.mocked(apiService.post).mockRejectedValue(new Error('network error'));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));

    expect(await screen.findByText('Could not generate an explanation. Please try again.')).toBeInTheDocument();
  });

  it('marking an alert reviewed from inside the popout closes the popout once the alert leaves the OPEN list', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: alerts });
    vi.mocked(apiService.patch).mockResolvedValue({ data: { ...alerts[0], status: 'REVIEWED' } });
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark Reviewed' }));

    await waitFor(() => expect(apiService.patch).toHaveBeenCalledWith('/governance-alerts/a1/status', { status: 'REVIEWED' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
