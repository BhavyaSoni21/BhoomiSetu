import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandClaimPanel from './LandClaimPanel';
import apiService from '../../../services/apiService';
import { AuthUser } from '../../auth/auth';

vi.mock('../../../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const citizen: AuthUser = { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' };

function makeFile(name = 'document.png') {
  return new File(['fake-image-bytes'], name, { type: 'image/png' });
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], citizen);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LandClaimPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const parcelA = { id: 'pa', canonicalParcelId: 'CAN-A', ulpin: 'ULPIN-A', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 500, geometry: '{}' };
const parcelB = { id: 'pb', canonicalParcelId: 'CAN-B', ulpin: 'ULPIN-B', stateCode: 'MH', districtCode: 'PUN', localBodyCode: 'MHLB001', areaSqM: 400, geometry: '{}' };

function chooseAndFind() {
  const input = document.getElementById('landClaimDocumentInput') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [makeFile()] } });
  fireEvent.click(screen.getByRole('button', { name: 'Find My Parcel' }));
}

describe('LandClaimPanel', () => {
  beforeEach(() => {
    vi.mocked(apiService.get).mockReset();
    vi.mocked(apiService.post).mockReset();
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url === '/parcels/mine') return { data: { parcels: [], total: 0 } };
      if (url === '/parcels') return { data: { parcels: [] } };
      throw new Error(`unexpected url: ${url}`);
    });
  });

  it('disables Find My Parcel until a file is chosen', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Find My Parcel' })).toBeDisabled();
  });

  it('identifies exactly one candidate and shows a confirmation card', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { extractedText: 'ULPIN-A', ocrConfidence: 90, candidates: [parcelA] } });
    renderPanel();

    chooseAndFind();

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/parcels/identify-from-document', expect.any(FormData), { headers: { 'Content-Type': undefined } }),
    );
    expect(await screen.findByText('Is this your parcel?')).toBeInTheDocument();
    expect(screen.getByText(/ULPIN-A/)).toBeInTheDocument();
  });

  it('confirming the single candidate opens the Land Claim request form for that parcel', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { extractedText: 'ULPIN-A', ocrConfidence: 90, candidates: [parcelA] } });
    renderPanel();
    chooseAndFind();

    fireEvent.click(await screen.findByRole('button', { name: 'Yes, Claim This Parcel' }));

    expect(await screen.findByText('Claim This Parcel', { selector: 'h3' })).toBeInTheDocument();
  });

  it('"Not This One" reveals the manual parcel search fallback', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { extractedText: 'ULPIN-A', ocrConfidence: 90, candidates: [parcelA] } });
    renderPanel();
    chooseAndFind();

    fireEvent.click(await screen.findByRole('button', { name: 'Not This One' }));

    expect(await screen.findByText(/Search Parcels/i)).toBeInTheDocument();
  });

  it('falls back to manual search with a helpful message when nothing matches', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { extractedText: 'gibberish', ocrConfidence: 40, candidates: [] } });
    renderPanel();
    chooseAndFind();

    expect(await screen.findByText(/couldn't match your document/)).toBeInTheDocument();
    expect(screen.getByText(/Search Parcels/i)).toBeInTheDocument();
  });

  it('falls back to manual search with a helpful message when multiple parcels match', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { extractedText: 'ambiguous', ocrConfidence: 80, candidates: [parcelA, parcelB] } });
    renderPanel();
    chooseAndFind();

    expect(await screen.findByText(/more than one possible match/)).toBeInTheDocument();
    expect(screen.getByText(/Search Parcels/i)).toBeInTheDocument();
  });

  it('shows "Already Yours" instead of a claim button for a parcel the citizen already owns, in the manual search fallback', async () => {
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url === '/parcels/mine') return { data: { parcels: [parcelA], total: 1 } };
      if (url === '/parcels') return { data: { parcels: [parcelA] } };
      throw new Error(`unexpected url: ${url}`);
    });
    vi.mocked(apiService.post).mockResolvedValue({ data: { extractedText: 'gibberish', ocrConfidence: 40, candidates: [] } });
    renderPanel();
    chooseAndFind();

    await screen.findByText(/Search Parcels/i);
    expect(await screen.findByText('Already Yours')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim This Parcel' })).not.toBeInTheDocument();
  });

  it('claiming a parcel found via the manual search fallback opens the request form', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { extractedText: 'gibberish', ocrConfidence: 40, candidates: [] } });
    vi.mocked(apiService.get).mockImplementation(async (url: string) => {
      if (url === '/parcels/mine') return { data: { parcels: [], total: 0 } };
      if (url === '/parcels') return { data: { parcels: [parcelB] } };
      throw new Error(`unexpected url: ${url}`);
    });
    renderPanel();
    chooseAndFind();

    fireEvent.click(await screen.findByRole('button', { name: 'Claim This Parcel' }));

    expect(await screen.findByText('Claim This Parcel', { selector: 'h3' })).toBeInTheDocument();
  });

  it('shows an error message when identification fails', async () => {
    vi.mocked(apiService.post).mockRejectedValue(new Error('network error'));
    renderPanel();
    chooseAndFind();

    expect(await screen.findByText(/Something went wrong reading your document/)).toBeInTheDocument();
  });
});
