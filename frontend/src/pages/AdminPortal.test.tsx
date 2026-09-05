import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPortal from './AdminPortal';
import apiService from '../services/apiService';
import { AuthUser } from '../features/auth/auth';

vi.mock('../services/apiService', () => ({
  default: { get: vi.fn() },
}));

const admin: AuthUser = { id: 'u1', email: 'admin@test.gov.in', name: 'Rina Admin', role: 'ADMIN' };
const managedAdmin = { ...admin, createdAt: '2026-01-01T00:00:00.000Z' };

function renderPortal(user: AuthUser | null = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminPortal />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

function mockApi() {
  vi.mocked(apiService.get).mockImplementation(async (url: string) => {
    if (url === '/analytics/summary') {
      return {
        data: {
          totals: { parcels: 0, workflows: 0, openAlerts: 0, activeDisputes: 0, totalUsers: 5, recentLogins24h: 2 },
          taxStatusDistribution: [], registrationStatusDistribution: [], landUseDistribution: [],
          disputeCaseStatusDistribution: [], workflowStatusDistribution: [], workflowTypeDistribution: [],
          alertSeverityDistribution: [], alertStatusDistribution: [],
        },
      };
    }
    if (url === '/predictive-analytics/top-risk-parcels') return { data: [] };
    if (url === '/users') return { data: [managedAdmin] };
    if (url === '/audit') return { data: [] };
    throw new Error(`unexpected url: ${url}`);
  });
}

describe('AdminPortal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.get).mockReset();
  });

  it('renders nothing when there is no authenticated user', () => {
    renderPortal(null);
    expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument();
  });

  it("shows the signed-in admin's name and the analytics/risk widgets", async () => {
    mockApi();
    renderPortal();

    expect(await screen.findByText(/Welcome, Rina Admin/)).toBeInTheDocument();
    expect(screen.getByText('Governance Analytics')).toBeInTheDocument();
    expect(screen.getByText('Top At-Risk Parcels')).toBeInTheDocument();
  });

  it('shows real total users and recent login counts, not static placeholders', async () => {
    mockApi();
    renderPortal();

    const usersValue = await screen.findByText('5');
    expect(within(usersValue.closest('div')!).getByText('Total Users')).toBeInTheDocument();
    const loginsValue = await screen.findByText('2');
    expect(within(loginsValue.closest('div')!).getByText('Logins (24h)')).toBeInTheDocument();
  });

  it('shows the User Management and Recent Activity sections', async () => {
    mockApi();
    renderPortal();

    expect(await screen.findByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(await screen.findByText('Rina Admin')).toBeInTheDocument(); // from the users list
    expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument();
  });

  it('logging out clears the shared session and the portal renders nothing', async () => {
    mockApi();
    const { client } = renderPortal();

    expect(await screen.findByText(/Welcome, Rina Admin/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(client.getQueryData(['auth-me'])).toBeNull();
    await waitFor(() => expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument());
  });
});
