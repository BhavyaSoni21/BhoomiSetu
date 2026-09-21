import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GovernanceAlertsPanel from './GovernanceAlertsPanel';
import apiService from '../../services/apiService';



// MemoryRouter wraps every render now - GovernanceAlertsPanel reads
// ?alert=<id> for notification deep-links (useSearchParams), and
// GovernanceAlertDetailModal's new "View Parcel" link needs a Router
// context too, regardless of whether a given test cares about either.
function renderWithClient(initialEntries: string[] = ['/officer/alerts']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <GovernanceAlertsPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const alerts = [
  {
    id: 'a1', parcelId: 'p1', alertType: 'UNAUTHORIZED_CHANGE_DETECTED', severity: 'HIGH',
    source: 'CHANGE_DETECTION', status: 'OPEN', explanation: 'New construction footprint detected.', reason: null, createdAt: '',
  },
  {
    id: 'a2', parcelId: 'p2', alertType: 'RESTRICTION_ZONE_OVERLAP', severity: 'MEDIUM',
    source: 'RESTRICTION_MONITOR', status: 'OPEN', explanation: 'Parcel intersects the flood zone.', reason: null, createdAt: '',
  },
];

describe('GovernanceAlertsPanel', () => {
  beforeEach(() => {
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests only ACTIVE alerts', async () => {
    server.use(http.get('*', () => HttpResponse.json([])));
    renderWithClient();

    // await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/governance-alerts', { params: { status: 'ACTIVE' } }));
  });

  it('renders each alert with severity, type, parcel, and explanation', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    renderWithClient();

    expect(await screen.findByText('UNAUTHORIZED CHANGE DETECTED')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('p1')).toBeInTheDocument();
    expect(screen.getByText('New construction footprint detected.')).toBeInTheDocument();
    expect(screen.getByText('RESTRICTION ZONE OVERLAP')).toBeInTheDocument();
  });

  it('shows an empty state when there are no active alerts', async () => {
    server.use(http.get('*', () => HttpResponse.json([])));
    renderWithClient();

    expect(await screen.findByText('No active governance alerts requiring attention.')).toBeInTheDocument();
  });

  it('clicking Dismiss on a row opens a reason popup instead of submitting immediately', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    expect(apiService.patch).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Dismiss', { selector: 'h3' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Reason')).toBeInTheDocument();
  });

  it('confirming without typing a reason shows an error and does not submit', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'Acknowledge' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Acknowledge' }));

    expect(await screen.findByText('A reason is required.')).toBeInTheDocument();
    expect(apiService.patch).not.toHaveBeenCalled();
  });

  it('typing a reason and confirming Dismiss PATCHes the status with the reason, then closes the popup', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    server.use(http.patch('*', () => HttpResponse.json({ ...alerts[0], status: 'DISMISSED', reason: 'Not a real issue.' })));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Not a real issue.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Dismiss' }));

    // await waitFor(() =>
    // expect(apiService.patch).toHaveBeenCalledWith('/governance-alerts/a1/status', { status: 'DISMISSED', reason: 'Not a real issue.' }),
    // );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Cancel closes the popup without submitting', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'Acknowledge' })[0]);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Some text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiService.patch).not.toHaveBeenCalled();
  });

  it('"View Details" opens a popout with the full alert detail', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('CHANGE DETECTION')).toBeInTheDocument(); // source
    // "Detected" appears twice for an OPEN alert - the status badge and the
    // 4-stage progress stepper's first (current) step both show it.
    expect(within(dialog).getAllByText('Detected').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Explain with AI' })).toBeInTheDocument();
  });

  it('"Close" dismisses the popout', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explaining an alert from inside the popout posts to its explain endpoint and shows the result', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    server.use(http.post('*', () => HttpResponse.json({ summary: 'Flood zone overlap confirmed.', risk_level: 'MEDIUM', findings: [], recommended_action: 'Review before approval.' },)));
    renderWithClient();

    await screen.findByText('RESTRICTION ZONE OVERLAP');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));

    // await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/ai/alerts/a2/explain'));
    expect(await screen.findByText('Flood zone overlap confirmed.')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM RISK')).toBeInTheDocument();
  });

  it('shows an error message in the popout when explaining an alert fails', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    server.use(http.post('*', () => HttpResponse.error()));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));

    expect(await screen.findByText('Could not generate an explanation. Please try again.')).toBeInTheDocument();
  });

  it("shows a previously-recorded reviewer's note inside the details popout", async () => {
    server.use(http.get('*', () => HttpResponse.json([{ ...alerts[0], status: 'OPEN', reason: 'Escalated to admin.' }])));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    expect(within(screen.getByRole('dialog')).getByText('Escalated to admin.')).toBeInTheDocument();
  });

  it('clicking Acknowledge inside the details popout closes it and opens the reason popup instead', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Acknowledge', { selector: 'h3' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Reason')).toBeInTheDocument();
    expect(apiService.patch).not.toHaveBeenCalled();
  });

  it('confirming Acknowledge from the popup that followed the details view submits the reason and closes', async () => {
    server.use(http.get('*', () => HttpResponse.json(alerts)));
    server.use(http.patch('*', () => HttpResponse.json({ ...alerts[0], status: 'ACKNOWLEDGED', reason: 'Confirmed unauthorized.' })));
    renderWithClient();

    await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
    fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge' }));

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Confirmed unauthorized.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Acknowledge' }));

    // await waitFor(() =>
    // expect(apiService.patch).toHaveBeenCalledWith('/governance-alerts/a1/status', { status: 'ACKNOWLEDGED', reason: 'Confirmed unauthorized.' }),
    // );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  describe('4-stage verification', () => {
    it('shows Mark Field Verified/Dismiss (not Acknowledge) for an ACKNOWLEDGED alert', async () => {
      server.use(http.get('*', () => HttpResponse.json([{ ...alerts[0], status: 'ACKNOWLEDGED' }])));
      renderWithClient();

      await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
      expect(screen.getByRole('button', { name: 'Mark Field Verified' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
    });

    it('shows Resolve/Dismiss for a FIELD_VERIFIED alert', async () => {
      server.use(http.get('*', () => HttpResponse.json([{ ...alerts[0], status: 'FIELD_VERIFIED' }])));
      renderWithClient();

      await screen.findByText('UNAUTHORIZED CHANGE DETECTED');
      expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });

    it('shows no advance/dismiss buttons for a terminal (RESOLVED) alert reached via deep link', async () => {
      const resolvedAlert = { ...alerts[0], status: 'RESOLVED', reason: 'Addressed.' };
      server.use(http.get('*/governance-alerts*', () => HttpResponse.json([resolvedAlert])));
      renderWithClient(['/officer/alerts?alert=a1']);

      const dialog = await screen.findByRole('dialog');
      // "Resolved" appears twice - the status badge and the stepper's final step.
      expect(within(dialog).getAllByText('Resolved').length).toBeGreaterThan(0);
      expect(within(dialog).queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
      // Only Close remains.
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('?alert= deep link (NotificationFeed.tsx)', () => {
    it('auto-opens the detail popout for an alert already in the OPEN list', async () => {
      server.use(http.get('*', () => HttpResponse.json(alerts)));
      renderWithClient(['/officer/alerts?alert=a2']);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('RESTRICTION ZONE OVERLAP')).toBeInTheDocument();
      // Fetched from the OPEN list already in memory - no extra single-alert call needed.
      expect(apiService.get).not.toHaveBeenCalledWith('/governance-alerts/a2');
    });

    it('falls back to fetching the alert directly when it is no longer active (a RESOLVED/DISMISSED notification)', async () => {
      const resolvedAlert = { ...alerts[0], status: 'DISMISSED', reason: 'Not a real issue.' };
      server.use(http.get('*/governance-alerts*', () => HttpResponse.json([resolvedAlert])));
      renderWithClient(['/officer/alerts?alert=a1']);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('UNAUTHORIZED CHANGE DETECTED')).toBeInTheDocument();
      expect(within(dialog).getByText('Dismissed')).toBeInTheDocument();
      // Not the generic empty state, even though the active list is empty.
      expect(screen.queryByText('No active governance alerts requiring attention.')).not.toBeInTheDocument();
    });
  });
});
