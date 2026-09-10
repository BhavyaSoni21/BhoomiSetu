import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './RegisterPage';
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
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const registeredUser = { id: 'c1', email: 'newcitizen@example.com', name: 'New Citizen', role: 'CITIZEN', emailVerified: false };

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(apiService.post).mockReset();
    mockNavigate.mockReset();
  });

  it('shows only the email field by default, and only the mobile field after switching', () => {
    renderPage();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mobile Number')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Register with Mobile' }));

    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mobile Number')).toBeInTheDocument();
  });

  it('rejects mismatched passwords client-side, without calling the API', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Different1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(apiService.post).not.toHaveBeenCalled();
  });

  it('registers with email and moves to the OTP step on success', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { accessToken: 'tok', user: registeredUser } });
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/auth/register', {
        name: 'New Citizen',
        method: 'EMAIL',
        email: 'newcitizen@example.com',
        mobileNumber: undefined,
        password: 'Password1',
        confirmPassword: 'Password1',
      }),
    );
    expect(await screen.findByText(/We've sent a 6-digit code to newcitizen@example.com/)).toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBe('tok');
  });

  it('registers with mobile and sends the OTP to the mobile number', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: { accessToken: 'tok', user: { id: 'c2', mobileNumber: '9000000001', name: 'Mobile Citizen', role: 'CITIZEN', mobileVerified: false } },
    });
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Register with Mobile' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Mobile Citizen' } });
    fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '9000000001' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText(/We've sent a 6-digit code to 9000000001/)).toBeInTheDocument();
  });

  // A duplicate account is a 409 Conflict (auth.service.ts's register()),
  // not a 400 - distinct from a malformed request so the frontend can show
  // a specific, professional message ("An account is already registered
  // with this email address...") instead of the generic fallback, and so
  // it never surfaces the raw backend error string directly.
  it('shows a professional, method-specific message on a duplicate-account 409 (email)', async () => {
    vi.mocked(apiService.post).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'An account with this email already exists' } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('An account is already registered with this email address. Please sign in instead.')).toBeInTheDocument();
  });

  it('shows a professional, method-specific message on a duplicate-account 409 (mobile)', async () => {
    vi.mocked(apiService.post).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'An account with this mobile number already exists' } },
    });
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Register with Mobile' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '9000000001' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('An account is already registered with this mobile number. Please sign in instead.')).toBeInTheDocument();
  });

  it('navigates to /citizen when "Skip for now" is clicked on the OTP step', async () => {
    vi.mocked(apiService.post).mockResolvedValue({ data: { accessToken: 'tok', user: registeredUser } });
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    fireEvent.click(await screen.findByText('Skip for now — verify later from Profile'));
    expect(mockNavigate).toHaveBeenCalledWith('/citizen');
  });

  it('toggles password visibility independently for password and confirm password', () => {
    renderPage();
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    const confirmInput = screen.getByLabelText('Confirm Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    expect(confirmInput.type).toBe('password');

    fireEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    expect(passwordInput.type).toBe('text');
    expect(confirmInput.type).toBe('password');
  });
});
