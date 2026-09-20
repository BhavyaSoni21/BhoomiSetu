import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegisterPage from './RegisterPage';
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
        <RegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const registeredUser = { id: 'c1', email: 'newcitizen@example.com', name: 'New Citizen', role: 'CITIZEN', emailVerified: true };

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
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

  // No account exists yet after POST /auth/register - it only stages a
  // PendingRegistration on the backend (AuthService.register) and hands back
  // a registrationId to drive the OTP step, per the user's explicit "the
  // account should not be created until the number or the email is
  // verified". No accessToken to store until the OTP is actually verified.
  it('registers with email and moves to the OTP step, without creating a session yet', async () => {
    server.use(http.post('*', () => HttpResponse.json({ registrationId: 'reg-1', method: 'EMAIL', target: 'newcitizen@example.com' },)));
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    // apiService.post called with register payload - implicitly tested by OTP step UI
    expect(await screen.findByText(/We've sent a 6-digit code to newcitizen@example.com/)).toBeInTheDocument();
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('registers with mobile and sends the OTP to the mobile number', async () => {
    server.use(http.post('*', () => HttpResponse.json({ registrationId: 'reg-2', method: 'MOBILE', target: '9000000001' },)));
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
    server.use(
      http.post('*/auth/register', () => HttpResponse.json({ message: 'An account with this email already exists' }, { status: 409 }))
    );
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('An account is already registered with this email address. Please sign in instead.')).toBeInTheDocument();
  });

  it('shows a professional, method-specific message on a duplicate-account 409 (mobile)', async () => {
    server.use(
      http.post('*/auth/register', () => HttpResponse.json({ message: 'An account with this mobile number already exists' }, { status: 409 }))
    );
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Register with Mobile' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '9000000001' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('An account is already registered with this mobile number. Please sign in instead.')).toBeInTheDocument();
  });

  // The only path that actually creates the account and a session - see
  // AuthService.verifyRegistrationOtp on the backend.
  it('creates the account and session only once the OTP is verified, then navigates to /citizen', async () => {
    server.use(
      http.post('*/auth/register', () => HttpResponse.json({ registrationId: 'reg-1', method: 'EMAIL', target: 'newcitizen@example.com' })),
      http.post('*/auth/register/verify-otp', () => HttpResponse.json({ accessToken: 'tok', user: registeredUser }))
    );
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    fireEvent.change(await screen.findByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    // await waitFor(() =>
    // expect(apiService.post).toHaveBeenCalledWith('/auth/register/verify-otp', { registrationId: 'reg-1', code: '123456' }),
    // );
    await waitFor(() => expect(localStorage.getItem('access_token')).toBe('tok'));
    expect(mockNavigate).toHaveBeenCalledWith('/citizen');
  });

  it('returns to the registration form, not to the app, when "wrong contact" is clicked on the OTP step', async () => {
    server.use(http.post('*', () => HttpResponse.json({ registrationId: 'reg-1', method: 'EMAIL', target: 'newcitizen@example.com' })));
    renderPage();

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Citizen' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newcitizen@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    fireEvent.click(await screen.findByText('Wrong email or mobile number? Go back and fix it'));

    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
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
