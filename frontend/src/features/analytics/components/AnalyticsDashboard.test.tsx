import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AnalyticsDashboard from './AnalyticsDashboard';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn() },
}));

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsDashboard />
    </QueryClientProvider>,
  );
}

const summary = {
  totals: { parcels: 200, workflows: 12, openAlerts: 36, activeDisputes: 24, totalUsers: 10, recentLogins24h: 3 },
  taxStatusDistribution: [{ key: 'PAID', count: 120 }, { key: 'OVERDUE', count: 20 }],
  registrationStatusDistribution: [{ key: 'REGISTERED', count: 150 }],
  landUseDistribution: [{ key: 'RESIDENTIAL', count: 50 }],
  disputeCaseStatusDistribution: [{ key: 'UNDER_REVIEW', count: 12 }],
  workflowStatusDistribution: [{ key: 'SUBMITTED', count: 8 }, { key: 'APPROVED', count: 3 }, { key: 'REJECTED', count: 1 }],
  workflowTypeDistribution: [{ key: 'ROR_COPY_REQUEST', count: 6 }],
  alertSeverityDistribution: [{ key: 'HIGH', count: 2 }],
  alertStatusDistribution: [{ key: 'OPEN', count: 36 }],
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
  });

  it('requests the summary endpoint', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: summary });
    renderWithClient();

    expect(await screen.findByText('200')).toBeInTheDocument();
    expect(apiService.get).toHaveBeenCalledWith('/analytics/summary');
  });

  it('renders the totals KPI cards', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: summary });
    renderWithClient();

    expect(await screen.findByText('200')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('renders a card title for every section, using meaningful titles rather than raw field names', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: summary });
    renderWithClient();

    await screen.findByText('200');
    expect(screen.getByText('Workflow Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Tax Compliance')).toBeInTheDocument();
    expect(screen.getByText('Registration Compliance')).toBeInTheDocument();
    expect(screen.getByText('Dispute Resolution Progress')).toBeInTheDocument();
    expect(screen.getByText('Governance Alerts by Stage')).toBeInTheDocument();
    expect(screen.getByText('Land Use Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Most Common Request Types')).toBeInTheDocument();
    expect(screen.getByText('Alerts by Severity')).toBeInTheDocument();
  });

  // The workflow pipeline chart pairs with a derived "approval rate" -
  // computed client-side from the same distribution data (no new endpoint
  // or business logic), only shown when at least one workflow has actually
  // been decided.
  it('shows the approval rate derived from decided workflows (approved / (approved + rejected))', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: summary });
    renderWithClient();

    await screen.findByText('200');
    // 3 approved / (3 approved + 1 rejected) = 75%
    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(screen.getByText('of decided requests approved')).toBeInTheDocument();
  });

  it('omits the approval rate when no workflow has been decided yet', async () => {
    vi.mocked(apiService.get).mockResolvedValue({
      data: { ...summary, workflowStatusDistribution: [{ key: 'SUBMITTED', count: 8 }] },
    });
    renderWithClient();

    await screen.findByText('200');
    expect(screen.queryByText('of decided requests approved')).not.toBeInTheDocument();
  });

  it('shows a "no data" message for an empty distribution', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: { ...summary, taxStatusDistribution: [] } });
    renderWithClient();

    await screen.findByText('200');
    expect(screen.getAllByText('No data').length).toBeGreaterThan(0);
  });

  it('shows an error message when the request fails', async () => {
    vi.mocked(apiService.get).mockRejectedValue(new Error('network error'));
    renderWithClient();

    expect(await screen.findByText('Error loading analytics')).toBeInTheDocument();
  });
});
