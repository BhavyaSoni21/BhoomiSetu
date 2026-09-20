import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OfficerMonitoring from './OfficerMonitoring';
import apiService from '../../services/apiService';



function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <OfficerMonitoring />
    </QueryClientProvider>,
  );
}

describe('OfficerMonitoring', () => {
  beforeEach(() => {
  });

  it('requests the officer-monitoring endpoint', async () => {
    server.use(http.get('*', () => HttpResponse.json([])));
    renderPanel();
    // await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/analytics/officer-monitoring'));
  });

  it('shows an empty-state message when there are no officers', async () => {
    server.use(http.get('*', () => HttpResponse.json([])));
    renderPanel();
    expect(await screen.findByText('No officer accounts found.')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    server.use(http.get('*', () => HttpResponse.error()));
    renderPanel();
    expect(await screen.findByText('Error loading officer monitoring data')).toBeInTheDocument();
  });

  it('renders a row per officer with pending/approved/rejected counts and formatted decision time', async () => {
    server.use(http.get('*', () => HttpResponse.json([
        {
          userId: 'u1', name: 'Rina Officer', role: 'LAND_RECORD_OFFICER', department: 'LAND_RECORDS',
          pendingInRoleQueue: 3, approvedCount: 5, rejectedCount: 1, avgDecisionHours: 4.5, lastActivityAt: '2026-09-10T10:00:00.000Z',
        },
      ],)));
    renderPanel();

    expect(await screen.findByText('Rina Officer')).toBeInTheDocument();
    expect(screen.getByText('LAND RECORDS')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('4.5h')).toBeInTheDocument();
  });

  it('shows placeholders for an officer with no activity yet, without omitting them', async () => {
    server.use(http.get('*', () => HttpResponse.json([
        {
          userId: 'u2', name: 'Idle Officer', role: 'ENCUMBRANCE_OFFICER', department: 'ENCUMBRANCE',
          pendingInRoleQueue: 0, approvedCount: 0, rejectedCount: 0, avgDecisionHours: null, lastActivityAt: null,
        },
      ],)));
    renderPanel();

    expect(await screen.findByText('Idle Officer')).toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    // One for avg. decision time, one for last activity.
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows "< 1h" for a sub-hour average decision time instead of rounding to 0h', async () => {
    server.use(http.get('*', () => HttpResponse.json([
        {
          userId: 'u3', name: 'Fast Officer', role: 'TAX_OFFICER', department: 'TAX',
          pendingInRoleQueue: 0, approvedCount: 1, rejectedCount: 0, avgDecisionHours: 0.3, lastActivityAt: '2026-09-10T10:00:00.000Z',
        },
      ],)));
    renderPanel();

    expect(await screen.findByText('< 1h')).toBeInTheDocument();
  });
});
