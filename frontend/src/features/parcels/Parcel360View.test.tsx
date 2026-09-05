import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Parcel360View from './Parcel360View';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

// MapComponent's own behaviour (maplibre, contextual layers) is covered by
// MapComponent.test.tsx - stub it here so this file focuses on the 360 data
// and service-request flow. Exposes onParcelClick so tests can simulate
// clicking a different parcel on the map.
vi.mock('../map/MapComponent', () => ({
  default: (props: { onParcelClick?: (id: string) => void }) => (
    <div data-testid="mock-map">
      <button onClick={() => props.onParcelClick?.('p2')}>Simulate map click on p2</button>
    </div>
  ),
}));

function renderWithProviders(parcelId = 'p1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/parcels/${parcelId}`]}>
        <Routes>
          <Route path="/parcels/:id" element={<Parcel360View />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fullResponse = {
  parcel_id: 'p1',
  identifiers: { ulpin: 'ULPIN123', survey_number: '55/2', plot_number: null, local_identifier: 'MH-PUN-0099' },
  location: { state: 'MH', district: 'PUN', locality: 'VIL555' },
  spatial: { area_sq_m: 26714, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
  sources: [
    { department: 'LAND_RECORDS', status: 'AVAILABLE' },
    { department: 'REGISTRATION', status: 'AVAILABLE' },
    { department: 'PLANNING', status: 'AVAILABLE' },
    { department: 'TAX', status: 'AVAILABLE' },
    { department: 'RESTRICTION', status: 'NOT_AVAILABLE' },
    { department: 'DISPUTE', status: 'AVAILABLE' },
  ],
  departments: {
    landRecords: { sourceSchema: 'STATE_A', sourceIdentifier: '55/2', ownerName: 'Interop Owner', areaSqM: 26714, locality: 'VIL555', raw: {} },
    registration: {
      id: 'r1', parcelId: 'p1', registrationStatus: 'REGISTERED', registrationNumber: 'REG-1',
      registrationDate: '2020-01-01', lastTransactionType: 'SALE', lastTransactionDate: '2020-01-01',
    },
    planning: {
      id: 'pl1', parcelId: 'p1', landUse: 'RESIDENTIAL', zoningClassification: 'Residential-1',
      masterPlanReference: 'Pune Master Plan 2025', buildingPermissionStatus: 'APPROVED',
    },
    tax: {
      id: 't1', parcelId: 'p1', assessedValue: 100000, annualTaxAmount: 500, taxStatus: 'PAID',
      outstandingAmount: 0, lastPaymentDate: '2026-01-01',
    },
    restriction: null,
    dispute: {
      id: 'd1', parcelId: 'p1', hasActiveDispute: true, disputeType: 'BOUNDARY', caseStatus: 'UNDER_REVIEW',
      filingDate: '2025-06-01', resolutionDate: null, resolutionSummary: null,
    },
  },
};

const secondResponse = {
  ...fullResponse,
  parcel_id: 'p2',
  identifiers: { ulpin: null, survey_number: null, plot_number: null, local_identifier: 'MH-PUN-0200' },
};

const riskScoreFixture = {
  parcelId: 'p1',
  overallScore: 46,
  riskBand: 'MEDIUM',
  dataCompleteness: 1,
  factors: [
    { key: 'TAX_DELINQUENCY', label: 'Tax Delinquency', weight: 0.4, available: true, score: 0, rationale: 'Tax status is PAID.' },
    { key: 'ACTIVE_DISPUTE', label: 'Dispute Exposure', weight: 0.3, available: true, score: 65, rationale: 'An active boundary dispute is under review.' },
    { key: 'GOVERNANCE_ALERTS', label: 'Open Governance Alerts', weight: 0.2, available: true, score: 0, rationale: 'No open governance alerts.' },
    { key: 'RESTRICTION', label: 'Land-Use Restriction', weight: 0.1, available: false, score: 0, rationale: 'No restriction record on file for this parcel.' },
  ],
};

// Parcel360View fires a /360, a /risk-score, AND a /workflows query per
// parcel; every test needs all three satisfied (not just the one it cares
// about) or the unmocked one rejects with "unexpected url" noise, or - with
// a blanket mockResolvedValue - the risk-score query would resolve with
// 360-shaped data and crash on `.factors.map`. /workflows defaults to empty
// so RequestNotifications renders nothing extra unless a test overrides it.
function mockGet(overrides: { parcel360?: unknown; riskScore?: unknown; workflows?: unknown } = {}) {
  vi.mocked(apiService.get).mockImplementation(async (url: string) => {
    if (url.includes('/risk-score')) return { data: overrides.riskScore ?? riskScoreFixture };
    if (url.includes('/workflows')) return { data: overrides.workflows ?? [] };
    if (url.includes('/360')) return { data: overrides.parcel360 ?? fullResponse };
    throw new Error(`unexpected url: ${url}`);
  });
}

describe('Parcel360View', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.post).mockReset();
  });

  it('fetches the aggregated 360 endpoint (no double /api/v1 prefix)', async () => {
    mockGet();
    renderWithProviders();

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/parcels/p1/360'));
  });

  it('renders the Overview tab by default with canonical identifiers and location', async () => {
    mockGet();
    renderWithProviders();

    expect(await screen.findByText('ULPIN123')).toBeInTheDocument();
    expect(screen.getByText('55/2')).toBeInTheDocument();
    expect(screen.getByText('VIL555')).toBeInTheDocument();
    expect(screen.getByText('26,714 m²')).toBeInTheDocument();
  });

  it('shows the "Your Requests" notification feed when the parcel has service requests', async () => {
    mockGet({
      workflows: [
        {
          id: 'wf-1', parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST', currentStatus: 'APPROVED',
          createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-02T10:00:00.000Z',
          steps: [{ id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'APPROVED', action: 'APPROVE', remarks: null, completedAt: '2026-09-02T10:00:00.000Z' }],
        },
      ],
    });
    renderWithProviders();

    expect(await screen.findByText('Your Requests')).toBeInTheDocument();
    expect(screen.getByText(/has been approved/)).toBeInTheDocument();
  });

  it('does not show the notification feed when the parcel has no service requests', async () => {
    mockGet();
    renderWithProviders();

    await screen.findByText('Parcel 360');
    expect(screen.queryByText('Your Requests')).not.toBeInTheDocument();
  });

  it('fetches and renders the risk assessment card with its factor breakdown', async () => {
    mockGet();
    renderWithProviders();

    expect(await screen.findByText('Risk Assessment')).toBeInTheDocument();
    expect(screen.getByText('46')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('100% data coverage')).toBeInTheDocument();
    expect(screen.getByText('Tax status is PAID.')).toBeInTheDocument();
    expect(screen.getByText('An active boundary dispute is under review.')).toBeInTheDocument();
    // The unavailable RESTRICTION factor renders "N/A" rather than its (meaningless) 0 score.
    const restrictionRow = screen.getByText('Land-Use Restriction').closest('.flex') as HTMLElement;
    expect(within(restrictionRow).getByText('N/A')).toBeInTheDocument();
  });

  it('shows AVAILABLE/NOT_AVAILABLE badges for every department source', async () => {
    mockGet();
    renderWithProviders();

    await screen.findByText('LAND RECORDS');
    const badges = screen.getAllByText(/AVAILABLE/);
    expect(badges).toHaveLength(6);
    expect(screen.getByText('NOT_AVAILABLE')).toBeInTheDocument();
  });

  it('switches to the Land Records tab and shows the adapted state-schema data', async () => {
    mockGet();
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'Land Records' }));

    expect(await screen.findByText('STATE_A')).toBeInTheDocument();
    expect(screen.getByText('Interop Owner')).toBeInTheDocument();
  });

  it('shows a "not available" message on the Restriction tab when departments.restriction is null', async () => {
    mockGet();
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'Restriction' }));

    expect(await screen.findByText(/No restriction data is available/)).toBeInTheDocument();
  });

  it('shows dispute details on the Dispute tab when departments.dispute is present', async () => {
    mockGet();
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'Dispute' }));

    expect(await screen.findByText('BOUNDARY')).toBeInTheDocument();
    expect(screen.getByText('UNDER_REVIEW')).toBeInTheDocument();
  });

  it('shows a "not available" message on the Dispute tab when departments.dispute is null', async () => {
    mockGet({ parcel360: { ...fullResponse, departments: { ...fullResponse.departments, dispute: null } } });
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'Dispute' }));

    expect(await screen.findByText(/No dispute data is available/)).toBeInTheDocument();
  });

  it('opens the service request form with the DISPUTE_FILING type when "File a Dispute" is clicked', async () => {
    mockGet();
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        id: 'wf2', parcelId: 'p1', workflowType: 'DISPUTE_FILING', currentStatus: 'SUBMITTED',
        createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
        steps: [{ id: 's9', stepOrder: 1, department: 'DISPUTE', assignedRole: 'DISPUTE_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null }],
      },
    });
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'File a Dispute' }));

    expect(await screen.findByText(/File a Dispute \(Ownership/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/workflows', expect.objectContaining({ parcelId: 'p1', workflowType: 'DISPUTE_FILING' })),
    );
    expect(await screen.findByText('Request Submitted')).toBeInTheDocument();
  });

  it('opens the service request form when "Request Documents" is clicked, and submits it', async () => {
    mockGet();
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        id: 'wf1', parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST', currentStatus: 'SUBMITTED',
        createdBy: null, requestDetails: null, lastRemarks: null, createdAt: '', updatedAt: '',
        steps: [{ id: 's1', stepOrder: 1, department: 'LAND_RECORDS', assignedRole: 'LAND_RECORD_OFFICER', status: 'PENDING', action: null, remarks: null, completedAt: null }],
      },
    });
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'Request Documents' }));

    expect(await screen.findByText(/Request a Copy of Record of Rights/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/workflows', expect.objectContaining({ parcelId: 'p1', workflowType: 'ROR_COPY_REQUEST' })),
    );
    expect(await screen.findByText('Request Submitted')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('LAND RECORDS')).toBeInTheDocument(); // underscores humanized, same as the Overview tab
  });

  it('shows "Parcel not found" and an error state appropriately', async () => {
    vi.mocked(apiService.get).mockRejectedValue(new Error('404'));
    renderWithProviders();

    expect(await screen.findByText('Error loading parcel details')).toBeInTheDocument();
  });

  it('switches the whole view to the clicked parcel when a different parcel is selected on the map', async () => {
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url === '/parcels/p1/360') return { data: fullResponse };
      if (url === '/parcels/p2/360') return { data: secondResponse };
      if (url.includes('/risk-score')) return { data: { ...riskScoreFixture, parcelId: url.split('/')[2] } };
      if (url.includes('/workflows')) return { data: [] };
      throw new Error(`unexpected url: ${url}`);
    });
    renderWithProviders('p1');

    expect(await screen.findByText('MH-PUN-0099')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simulate map click on p2' }));

    await waitFor(() => expect(apiService.get).toHaveBeenCalledWith('/parcels/p2/360'));
    expect(await screen.findByText('MH-PUN-0200')).toBeInTheDocument();
    expect(screen.queryByText('MH-PUN-0099')).not.toBeInTheDocument();
    expect(screen.getByText('p2')).toBeInTheDocument();
  });

  it('clicking "Explain with AI" posts to the explain endpoint and shows the result', async () => {
    mockGet();
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        summary: 'This parcel is in good standing overall.',
        risk_level: 'LOW',
        findings: [{ type: 'Tax', description: 'Tax is paid in full.' }],
        recommended_action: 'No action needed.',
      },
    });
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));

    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/ai/parcels/p1/explain'));
    expect(await screen.findByText('This parcel is in good standing overall.')).toBeInTheDocument();
    expect(screen.getByText('LOW RISK')).toBeInTheDocument();
  });

  it('shows an error message when the AI explanation request fails', async () => {
    mockGet();
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 503 } });
    renderWithProviders();

    await screen.findByText('Parcel 360');
    fireEvent.click(screen.getByRole('button', { name: 'Explain with AI' }));

    expect(await screen.findByText('AI is not configured on this server.')).toBeInTheDocument();
  });
});
