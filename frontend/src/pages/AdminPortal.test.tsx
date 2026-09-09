import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPortal from './AdminPortal';
import apiService from '../services/apiService';
import { AuthUser } from '../features/auth/auth';

vi.mock('../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

// MapLibre needs real canvas/WebGL support that jsdom doesn't provide -
// AdminPortal statically imports AdminMapLayerAuthoringPage, which pulls in
// LayerGeometryDrawMap's own maplibre-gl usage, even though no test here
// navigates to that route (same reason App.test.tsx stubs MapComponent).
vi.mock('../features/admin/LayerGeometryDrawMap', () => ({
  default: () => <div data-testid="draw-map-stub" />,
}));
vi.mock('../features/admin/AdminCombinedLayerMap', () => ({
  default: () => <div data-testid="combined-map-stub" />,
}));

const admin: AuthUser = { id: 'u1', email: 'admin@test.gov.in', name: 'Rina Admin', role: 'ADMIN' };
const managedAdmin = { ...admin, createdAt: '2026-01-01T00:00:00.000Z' };

// AdminPortal owns its own relative <Routes> now (docs/FRONTEND_UPGRADE_SPEC.md
// §7, Phase 3), same pattern as OfficerPortal.tsx - a bare MemoryRouter's
// default "/" location hits its index route (the Dashboard); pass
// initialEntries to reach another of its pages.
function renderPortal(user: AuthUser | null = admin, initialEntries: string[] = ['/']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>
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
    if (url === '/admin/departments') return { data: [] };
    if (url === '/analytics/officer-monitoring') return { data: [] };
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
    expect(screen.queryByText(/Welcome,/)).not.toBeInTheDocument();
  });

  it("shows the signed-in admin's name and the analytics/risk widgets on the Dashboard", async () => {
    mockApi();
    renderPortal();

    expect(await screen.findByText(/Welcome, Rina Admin/)).toBeInTheDocument();
    expect(screen.getByText('Governance Analytics')).toBeInTheDocument();
    expect(screen.getByText('Top At-Risk Parcels')).toBeInTheDocument();
  });

  it('shows the User Management section with real users on the Dashboard', async () => {
    mockApi();
    renderPortal();

    expect(await screen.findByText('User Management')).toBeInTheDocument();
    expect(await screen.findByText('Rina Admin')).toBeInTheDocument(); // from the users list
  });

  it('the Departments page shows the department directory', async () => {
    mockApi();
    renderPortal(admin, ['/departments']);

    expect(await screen.findByText('Department Directory')).toBeInTheDocument();
    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/admin/departments'));
    expect(screen.getByText('No departments yet.')).toBeInTheDocument();
  });

  it('the System Monitoring page shows real system totals and the activity log', async () => {
    mockApi();
    renderPortal(admin, ['/system-monitoring']);

    expect(await screen.findByRole('heading', { name: 'System Monitoring' })).toBeInTheDocument();
    const usersValue = await screen.findByText('5');
    expect(within(usersValue.closest('div')!).getByText('Total Users')).toBeInTheDocument();
    const loginsValue = await screen.findByText('2');
    expect(within(loginsValue.closest('div')!).getByText('Logins (24h)')).toBeInTheDocument();
    expect(await screen.findByText('No activity recorded yet.')).toBeInTheDocument();
  });

  it('the Officer Monitoring page fetches and shows officer workload/decision data', async () => {
    mockApi();
    renderPortal(admin, ['/officer-monitoring']);

    expect(await screen.findByRole('heading', { name: 'Officer Monitoring' })).toBeInTheDocument();
    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/analytics/officer-monitoring'));
    expect(screen.getByText('No officer accounts found.')).toBeInTheDocument();
  });
});
