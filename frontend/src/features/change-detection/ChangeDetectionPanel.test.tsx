import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChangeDetectionPanel from './ChangeDetectionPanel';
import apiService from '../../services/apiService';



const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ChangeDetectionPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// jsdom applies native HTML5 constraint validation on a click-triggered
// submit, which blocks it (and any submit event at all) when a `required`
// field isn't recognized as filled - that's about the browser's validation
// UI, not this component's logic, so tests dispatch the submit event
// directly to bypass it, the same way a real user's already-valid form
// submission would reach the handler.
function submitForm() {
  fireEvent.submit(screen.getByRole('button', { name: 'Analyze' }).closest('form')!);
}

function fillForm() {
  const beforeFile = new File(['before'], 'before.png', { type: 'image/png' });
  const afterFile = new File(['after'], 'after.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Before Image'), { target: { files: [beforeFile] } });
  fireEvent.change(screen.getByLabelText('After Image'), { target: { files: [afterFile] } });
  fireEvent.change(screen.getByLabelText('Min Longitude'), { target: { value: '73.8492' } });
  fireEvent.change(screen.getByLabelText('Min Latitude'), { target: { value: '18.5129' } });
  fireEvent.change(screen.getByLabelText('Max Longitude'), { target: { value: '73.8642' } });
  fireEvent.change(screen.getByLabelText('Max Latitude'), { target: { value: '18.5279' } });
}

describe('ChangeDetectionPanel', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('the Analyze button is disabled until both images are chosen', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
  });

  it('"Use Pune cluster bounds" fills in the bounds fields', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Use Pune cluster bounds' }));

    expect(screen.getByLabelText('Min Longitude')).toHaveValue(73.8492);
    expect(screen.getByLabelText('Max Latitude')).toHaveValue(18.5279);
  });

  it('submits a multipart request with the images and bounds, and shows the result', async () => {
    let capturedBody: FormData | null = null;
    server.use(
      http.post('*/change-detection/analyze', async ({ request }) => {
        capturedBody = await request.formData() as FormData;
        return HttpResponse.json({ changeDetected: true, changedPixelRatio: 0.108, changeRegion: { type: 'Polygon', coordinates: [] }, eventId: 'evt1', affectedParcelIds: ['p1', 'p2'], alertsCreated: 2 });
      })
    );
    renderPanel();
    fillForm();
    submitForm();

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody!.get('minLng')).toBe('73.8492');
    expect((capturedBody!.get('before') as File).name).toBe('before.png');

    expect(await screen.findByText('Change detected: 10.8% of the analyzed area')).toBeInTheDocument();
    expect(screen.getByText('2 parcel(s) affected, 2 governance alert(s) created.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2);
  });

  it('navigates to the parcel 360 view when an affected parcel\'s View is clicked', async () => {
    server.use(http.post('*', () => HttpResponse.json({ changeDetected: true, changedPixelRatio: 0.05, changeRegion: { type: 'Polygon', coordinates: [] }, eventId: 'evt1', affectedParcelIds: ['p1'], alertsCreated: 1 },)));
    renderPanel();
    fillForm();
    submitForm();

    fireEvent.click(await screen.findByRole('button', { name: 'View' }));
    expect(mockNavigate).toHaveBeenCalledWith('/parcels/p1');
  });

  it('shows a "no significant change" message when changeDetected is false', async () => {
    server.use(http.post('*', () => HttpResponse.json({ changeDetected: false, changedPixelRatio: 0.0004, changeRegion: null, eventId: null, affectedParcelIds: [], alertsCreated: 0 },)));
    renderPanel();
    fillForm();
    submitForm();

    expect(await screen.findByText(/No significant change detected/)).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    server.use(http.post('*', () => HttpResponse.json({}, { status: 500 })));
    renderPanel();
    fillForm();
    submitForm();

    expect(await screen.findByText(/Something went wrong analyzing this imagery/)).toBeInTheDocument();
  });
});
