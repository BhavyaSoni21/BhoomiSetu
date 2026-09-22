import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyParcels from './MyParcels';
import apiService from '../../services/apiService';
import { AuthUser } from '../auth/auth';



const citizen: AuthUser = { id: 'c1', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' };
const officer: AuthUser = { id: 'o1', email: 'officer@test.gov.in', name: 'An Officer', role: 'LAND_RECORD_OFFICER' };

function renderPanel(user: AuthUser | null, initialEntries = ['/citizen/parcels']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth-me'], user);
  return {
    client,
    ...renderWithProviders(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>
          <MyParcels />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('MyParcels', () => {
  beforeEach(() => {
  });

  it('prompts to sign in when not authenticated, and never calls /parcels/mine', async () => {
    renderPanel(null);
    expect(screen.getByRole('link', { name: /Sign in/i })).toHaveAttribute('href', '/login');
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it('prompts to sign in for a non-citizen without calling /parcels/mine', async () => {
    renderPanel(officer);
    expect(screen.getByRole('link', { name: /Sign in/i })).toBeInTheDocument();
    expect(apiService.get).not.toHaveBeenCalled();
  });

  it('shows an empty state with Link Parcel CTA for a citizen with no linked parcels', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [], total: 0 })));
    renderPanel(citizen);

    expect(await screen.findByText(/No registered parcels on your profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Link a Parcel to Get Started/i)).toBeInTheDocument();
    expect(apiService.get).toHaveBeenCalledWith('/parcels/mine');
  });

  it('displays contextual banner when arriving from blocked complaint flow', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [], total: 0 })));
    renderPanel(citizen, ['/citizen/parcels?from=raise-request']);

    expect(await screen.findByText(/Parcel Verification Required/i)).toBeInTheDocument();
    expect(screen.getByText(/You need to verify and link a parcel before raising a request/i)).toBeInTheDocument();
  });

  it("lists a citizen's linked parcels with status badges", async () => {
    server.use(http.get('*', () => HttpResponse.json({
        total: 2,
        parcels: [
          {
            id: 'p1234567-aaaa',
            canonicalParcelId: 'CAN10000',
            localId: 'MH-AH-SH-588/2',
            ulpin: 'ULPIN0001',
            stateCode: 'MH',
            districtCode: 'AH',
            localBodyCode: 'SH',
            areaSqM: 5000,
            geometry: '{}',
            status: 'Registered',
          },
          {
            id: 'p2234567-bbbb',
            canonicalParcelId: 'CAN10001',
            localId: 'MH-AH-SH-102/3',
            ulpin: null,
            stateCode: 'MH',
            districtCode: 'AH',
            localBodyCode: 'SH',
            areaSqM: 3200,
            geometry: '{}',
            status: 'Pending Verification',
          },
        ],
      },)));
    renderPanel(citizen);

    expect(await screen.findByText(/MH-AH-SH-588\/2/)).toBeInTheDocument();
    expect(screen.getAllByText(/MH-AH-SH-102\/3/).length).toBeGreaterThanOrEqual(1);
    // The status badge text comes from translation - parcelStatus.pending = 'Pending'
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
    // Registered badge should also be present
    expect(screen.getByText(/Registered/i)).toBeInTheDocument();
  });

  it('opens and closes the new parcel verification form on button click', async () => {
    server.use(http.get('*', () => HttpResponse.json({ parcels: [], total: 0 })));
    renderPanel(citizen);

    const newParcelBtn = await screen.findByRole('button', { name: /\+ New Parcel/i });
    fireEvent.click(newParcelBtn);

    expect(screen.getByText(/New Property Ownership Claim/i)).toBeInTheDocument();
    expect(screen.getByText(/Find My Parcel/i)).toBeInTheDocument();
  });

  it('allows citizen to delete a pending parcel submission with confirmation modal', async () => {
    server.use(http.get('*', () => HttpResponse.json({
        total: 1,
        parcels: [
          {
            id: 'p2234567-bbbb',
            canonicalParcelId: 'CAN10001',
            localId: 'MH-AH-SH-102/3',
            ulpin: null,
            stateCode: 'MH',
            districtCode: 'AH',
            localBodyCode: 'SH',
            areaSqM: 3200,
            geometry: '{}',
            status: 'Pending Verification',
          },
        ],
      },)));
    server.use(http.delete('*', () => HttpResponse.json({ success: true })));

    renderPanel(citizen);

    const elements = await screen.findAllByText(/MH-AH-SH-102\/3/);
    expect(elements.length).toBeGreaterThanOrEqual(1);

    // The delete button for pending submissions says "Keep it" (translation key: myParcels.deletePendingLink)
    const deleteBtn = screen.getByRole('button', { name: /Keep it/i });
    fireEvent.click(deleteBtn);

    // Modal title is "Remove Pending Parcel?" (translation key: myParcels.deleteModalTitle)
    expect(screen.getByText(/Remove Pending Parcel\?/i)).toBeInTheDocument();
    // The confirm button says "Delete Permanently" (translation key: myParcels.confirmDeleteBtn)
    const confirmBtn = screen.getByRole('button', { name: /Delete Permanently/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiService.delete).toHaveBeenCalledWith('/parcels/mine/p2234567-bbbb');
    });
  });
});
