import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './LoginPage';
import apiService from '../services/apiService';



const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return renderWithProviders(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
  });

  it('logs in and navigates to /officer for an officer role', async () => {
    server.use(http.post('*', () => HttpResponse.json({ accessToken: 'tok', user: { id: 'u1', email: 'lr@test.gov.in', name: 'Asha', role: 'LAND_RECORD_OFFICER' } },)));
    renderPage();

    fillAndSubmit('lr@test.gov.in', 'Demo@123');

    // await waitFor(() =>
    // expect(apiService.post).toHaveBeenCalledWith('/auth/login', { email: 'lr@test.gov.in', password: 'Demo@123' }),
    // );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/officer'));
    expect(localStorage.getItem('access_token')).toBe('tok');
  });

  it('logs in and navigates to /admin for the admin role', async () => {
    server.use(http.post('*', () => HttpResponse.json({ accessToken: 'tok', user: { id: 'u2', email: 'admin@test.gov.in', name: 'Admin', role: 'ADMIN' } },)));
    renderPage();

    fillAndSubmit('admin@test.gov.in', 'Demo@123');

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });

  it('logs in and navigates to /citizen for the citizen role', async () => {
    server.use(http.post('*', () => HttpResponse.json({ accessToken: 'tok', user: { id: 'u3', email: 'citizen1@example.com', name: 'A Citizen', role: 'CITIZEN' } },)));
    renderPage();

    fillAndSubmit('citizen1@example.com', 'Demo@123');

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/citizen'));
  });

  it('shows an invalid-credentials message on a 401', async () => {
    server.use(http.post('*', () => HttpResponse.json({}, { status: 401 })));
    renderPage();

    fillAndSubmit('lr@test.gov.in', 'WrongPassword');

    expect(await screen.findByText('Invalid credentials.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a generic error message on a non-401 failure', async () => {
    server.use(http.post('*', () => HttpResponse.json({}, { status: 500 })));
    renderPage();

    fillAndSubmit('lr@test.gov.in', 'Demo@123');

    expect(await screen.findByText(/Something went wrong signing in/)).toBeInTheDocument();
  });

  it('lists the demo accounts for convenience', () => {
    renderPage();
    expect(screen.getByText(/admin@bhoomisetu.gov.in/)).toBeInTheDocument();
    expect(screen.getByText(/dispute.officer@bhoomisetu.gov.in/)).toBeInTheDocument();
  });

  // Method-selector (docs/FRONTEND_UPGRADE_SPEC.md §3) - a toggle, not both
  // fields shown at once.
  it('shows only the email field by default, and only the mobile field after switching', () => {
    renderPage();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mobile Number')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Login with Mobile' }));

    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mobile Number')).toBeInTheDocument();
  });

  it('logs in with a mobile number when that method is selected', async () => {
    server.use(http.post('*', () => HttpResponse.json({ accessToken: 'tok', user: { id: 'u4', mobileNumber: '9000000001', name: 'Mobile Citizen', role: 'CITIZEN' } },)));
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Login with Mobile' }));
    fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '9000000001' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Demo@123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    // await waitFor(() =>
    // expect(apiService.post).toHaveBeenCalledWith('/auth/login', { mobileNumber: '9000000001', password: 'Demo@123' }),
    // );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/citizen'));
  });

  it('toggles password visibility', () => {
    renderPage();
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput.type).toBe('password');
  });
});
