import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OtpEntryForm from './OtpEntryForm';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { post: vi.fn() },
}));

function renderForm(onVerified = vi.fn(), onCancel = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    onVerified,
    onCancel,
    ...render(
      <QueryClientProvider client={client}>
        <OtpEntryForm method="EMAIL" target="citizen@example.com" onVerified={onVerified} onCancel={onCancel} />
      </QueryClientProvider>,
    ),
  };
}

describe('OtpEntryForm', () => {
  beforeEach(() => {
    vi.mocked(apiService.post).mockReset();
  });

  it('shows who the code was sent to', () => {
    renderForm();
    expect(screen.getByText(/citizen@example.com/)).toBeInTheDocument();
  });

  it('submits the entered code and calls onVerified with the updated user', async () => {
    const updatedUser = { id: 'c1', email: 'citizen@example.com', name: 'A Citizen', role: 'CITIZEN', emailVerified: true };
    vi.mocked(apiService.post).mockResolvedValue({ data: updatedUser });
    const { onVerified } = renderForm();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/auth/verify-otp', { method: 'EMAIL', code: '123456' }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(updatedUser));
  });

  it('strips non-digit characters and caps at 6 digits', () => {
    renderForm();
    const input = screen.getByLabelText('Verification Code') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ab12cd34ef56gh' } });
    expect(input.value).toBe('123456');
  });

  it('shows an invalid-code error on a 400', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 400 } });
    renderForm();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Invalid or expired code. Please try again.')).toBeInTheDocument();
  });

  it('shows a locked-out message on a 403', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
    renderForm();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Too many incorrect attempts — request a new code.')).toBeInTheDocument();
  });

  it('starts with resend disabled, inside the cooldown window', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /Resend/ })).toBeDisabled();
  });

  it('calls onCancel when "Skip for now" is clicked', () => {
    const { onCancel } = renderForm();
    fireEvent.click(screen.getByText('Skip for now — verify later from Profile'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables Verify until at least 4 digits are entered', () => {
    renderForm();
    const verifyButton = screen.getByRole('button', { name: 'Verify' });
    expect(verifyButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123' } });
    expect(verifyButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '1234' } });
    expect(verifyButton).not.toBeDisabled();
  });
});
