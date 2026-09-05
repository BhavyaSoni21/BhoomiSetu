import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OfficerLogin from './OfficerLogin';

describe('OfficerLogin', () => {
  it('does not submit when name is blank', () => {
    const onLogin = vi.fn();
    render(<OfficerLogin onLogin={onLogin} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onLogin).not.toHaveBeenCalled();
  });

  it('submits the trimmed name and selected role', () => {
    const onLogin = vi.fn();
    render(<OfficerLogin onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Asha Verma  ' } });
    fireEvent.change(screen.getByLabelText('Department / Role'), { target: { value: 'PLANNING_OFFICER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onLogin).toHaveBeenCalledWith({ name: 'Asha Verma', role: 'PLANNING_OFFICER' });
  });

  it('defaults to the Land Record Officer role', () => {
    const onLogin = vi.fn();
    render(<OfficerLogin onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ravi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(onLogin).toHaveBeenCalledWith({ name: 'Ravi', role: 'LAND_RECORD_OFFICER' });
  });
});
