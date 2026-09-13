import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OtpEntryForm from './OtpEntryForm';
import { AuthUser } from './auth';

const updatedUser: AuthUser = { id: 'c1', email: 'citizen@example.com', name: 'A Citizen', role: 'CITIZEN', emailVerified: true };

// verify/resend are injected props now (not hardcoded hooks) so this same
// component can drive both Profile's add/change-contact flow and the
// pre-account registration flow - render() below stands in for whichever
// caller wires it up (see ContactMethodCard.tsx / RegisterPage.tsx).
function renderForm(overrides: Partial<React.ComponentProps<typeof OtpEntryForm>> = {}) {
  const onVerifyCode = vi.fn().mockResolvedValue(updatedUser);
  const onResend = vi.fn().mockResolvedValue(undefined);
  const onVerified = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <OtpEntryForm
      method="EMAIL"
      target="citizen@example.com"
      onVerifyCode={onVerifyCode}
      onResend={onResend}
      verifying={false}
      resending={false}
      verifyError={null}
      onVerified={onVerified}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onVerifyCode, onResend, onVerified, onCancel, ...utils };
}

describe('OtpEntryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows who the code was sent to', () => {
    renderForm();
    expect(screen.getByText(/citizen@example.com/)).toBeInTheDocument();
  });

  it('submits the entered code via onVerifyCode and calls onVerified with the result', async () => {
    const { onVerifyCode, onVerified } = renderForm();

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(onVerifyCode).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(updatedUser));
  });

  it('strips non-digit characters and caps at 6 digits', () => {
    renderForm();
    const input = screen.getByLabelText('Verification Code') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ab12cd34ef56gh' } });
    expect(input.value).toBe('123456');
  });

  it('shows an invalid-code error when onVerifyCode rejects with a 400', async () => {
    const onVerifyCode = vi.fn().mockRejectedValue({ isAxiosError: true, response: { status: 400 } });
    renderForm({ onVerifyCode });

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Invalid or expired code. Please try again.')).toBeInTheDocument();
  });

  it('shows a locked-out message when onVerifyCode rejects with a 403', async () => {
    const onVerifyCode = vi.fn().mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
    renderForm({ onVerifyCode });

    fireEvent.change(screen.getByLabelText('Verification Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Too many incorrect attempts — request a new code.')).toBeInTheDocument();
  });

  it('starts with resend disabled, inside the cooldown window', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /Resend/ })).toBeDisabled();
  });

  it('calls onCancel when "Skip for now" is clicked, when a cancel option is given', () => {
    const { onCancel } = renderForm();
    fireEvent.click(screen.getByText('Skip for now — verify later from Profile'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders no cancel/skip option when onCancel is omitted (the registration flow)', () => {
    renderForm({ onCancel: undefined });
    expect(screen.queryByText('Skip for now — verify later from Profile')).not.toBeInTheDocument();
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

  it('reflects the verifying prop on the submit button', () => {
    renderForm({ verifying: true });
    expect(screen.getByRole('button', { name: 'Verifying...' })).toBeDisabled();
  });
});
