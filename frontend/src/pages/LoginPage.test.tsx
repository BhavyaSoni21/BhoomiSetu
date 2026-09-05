import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './LoginPage';
import apiService from '../services/apiService';

vi.mock('../services/apiService', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
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
    vi.mocked(apiService.post).mockReset();
    mockNavigate.mockReset();
  });

  it('logs in and navigates to /officer for an officer role', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { accessToken: 'tok', user: { id: 'u1', email: 'lr@test.gov.in', name: 'Asha', role: 'LAND_RECORD_OFFICER' } },
    });
    renderPage();

    fillAndSubmit('lr@test.gov.in', 'Demo@123');

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/auth/login', { email: 'lr@test.gov.in', password: 'Demo@123' }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/officer'));
    expect(localStorage.getItem('access_token')).toBe('tok');
  });

  it('logs in and navigates to /admin for the admin role', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { accessToken: 'tok', user: { id: 'u2', email: 'admin@test.gov.in', name: 'Admin', role: 'ADMIN' } },
    });
    renderPage();

    fillAndSubmit('admin@test.gov.in', 'Demo@123');

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });

  it('shows an invalid-credentials message on a 401', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
    renderPage();

    fillAndSubmit('lr@test.gov.in', 'WrongPassword');

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a generic error message on a non-401 failure', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 500 } });
    renderPage();

    fillAndSubmit('lr@test.gov.in', 'Demo@123');

    expect(await screen.findByText(/Something went wrong signing in/)).toBeInTheDocument();
  });

  it('lists the demo accounts for convenience', () => {
    renderPage();
    expect(screen.getByText(/admin@bhoomisetu.gov.in/)).toBeInTheDocument();
    expect(screen.getByText(/dispute.officer@bhoomisetu.gov.in/)).toBeInTheDocument();
  });
});
