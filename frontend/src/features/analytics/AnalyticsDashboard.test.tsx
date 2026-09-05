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
  totals: { parcels: 200, workflows: 12, openAlerts: 36, activeDisputes: 24 },
  taxStatusDistribution: [{ key: 'PAID', count: 120 }, { key: 'OVERDUE', count: 20 }],
  registrationStatusDistribution: [{ key: 'REGISTERED', count: 150 }],
  landUseDistribution: [{ key: 'RESIDENTIAL', count: 50 }],
  disputeCaseStatusDistribution: [{ key: 'UNDER_REVIEW', count: 12 }],
  workflowStatusDistribution: [{ key: 'SUBMITTED', count: 8 }],
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

  it('renders the totals stat cards', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: summary });
    renderWithClient();

    expect(await screen.findByText('200')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('renders a chart title for every distribution', async () => {
    vi.mocked(apiService.get).mockResolvedValue({ data: summary });
    renderWithClient();

    await screen.findByText('200');
    expect(screen.getByText('Tax Status')).toBeInTheDocument();
    expect(screen.getByText('Registration Status')).toBeInTheDocument();
    expect(screen.getByText('Land Use')).toBeInTheDocument();
    expect(screen.getByText('Dispute Case Status')).toBeInTheDocument();
    expect(screen.getByText('Workflow Status')).toBeInTheDocument();
    expect(screen.getByText('Workflow Type')).toBeInTheDocument();
    expect(screen.getByText('Alert Severity')).toBeInTheDocument();
    expect(screen.getByText('Alert Status')).toBeInTheDocument();
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
