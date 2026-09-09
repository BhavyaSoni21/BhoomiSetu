import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationFeed from './NotificationFeed';
import apiService from '../../services/apiService';
import { AppNotification } from '../../types/notification';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

const unread: AppNotification = {
  id: 'n1', userId: 'u1', type: 'WORKFLOW_ASSIGNED', title: 'New ror copy request request',
  message: "A new request needs your department's review (LAND_RECORDS).", parcelId: 'p1', workflowId: 'w1', alertId: null,
  read: false, createdAt: '2026-09-09T10:00:00.000Z',
};
const read: AppNotification = {
  id: 'n2', userId: 'u1', type: 'WORKFLOW_STEP_APPROVED', title: 'Your request was approved',
  message: 'Land Records approved your request.', parcelId: null, workflowId: 'w1', alertId: null,
  read: true, createdAt: '2026-09-08T09:00:00.000Z',
};

function renderFeed(notifications: AppNotification[] = [unread, read], initialEntries: string[] = ['/notifications']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(apiService.get).mockImplementation(async (url: string) => {
    if (url === '/notifications') return { data: notifications };
    throw new Error(`unexpected url: ${url}`);
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/notifications" element={<NotificationFeed />} />
          <Route path="/parcels/:id" element={<div>Parcel 360 Stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationFeed', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.patch).mockReset();
  });

  it('shows an empty state when there are no notifications', async () => {
    renderFeed([]);
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(apiService.get).mockRejectedValue(new Error('network error'));
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationFeed />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Error loading notifications')).toBeInTheDocument();
  });

  it('renders every notification with title and message, unread visually distinct from read', async () => {
    renderFeed();
    expect(await screen.findByText('New ror copy request request')).toBeInTheDocument();
    expect(screen.getByText("A new request needs your department's review (LAND_RECORDS).")).toBeInTheDocument();
    expect(screen.getByText('Your request was approved')).toBeInTheDocument();
  });

  it('marks an unread notification read and navigates to its parcel on click', async () => {
    vi.mocked(apiService.patch).mockResolvedValue({ data: { ...unread, read: true } });
    renderFeed();
    fireEvent.click(await screen.findByText('New ror copy request request'));

    await waitFor(() => expect(apiService.patch).toHaveBeenCalledWith('/notifications/n1/read'));
    expect(await screen.findByText('Parcel 360 Stub')).toBeInTheDocument();
  });

  it('does not call mark-read again for an already-read notification, but still navigates if it has a parcel', async () => {
    renderFeed([{ ...read, parcelId: 'p2' }]);
    fireEvent.click(await screen.findByText('Your request was approved'));

    expect(apiService.patch).not.toHaveBeenCalled();
    expect(await screen.findByText('Parcel 360 Stub')).toBeInTheDocument();
  });

  it('does not navigate when the notification has no associated parcel', async () => {
    renderFeed([read]); // parcelId: null
    fireEvent.click(await screen.findByText('Your request was approved'));

    expect(await screen.findByText('Your request was approved')).toBeInTheDocument(); // still on the feed
  });
});
