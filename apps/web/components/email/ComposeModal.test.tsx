import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as emailApi from '@/lib/email-api';
import { ComposeModal } from './ComposeModal';

vi.mock('@/lib/email-api', () => ({
  sendEmail: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ComposeModal', () => {
  it('renders compose fields', () => {
    render(<ComposeModal onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText('empfänger@beispiel.de')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Betreff')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Senden/ })).toBeInTheDocument();
  });

  it('pre-fills default values', () => {
    render(<ComposeModal defaultTo="alice@acme.com" defaultSubject="Re: Test" onClose={vi.fn()} />);

    expect(screen.getByDisplayValue('alice@acme.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Re: Test')).toBeInTheDocument();
  });

  it('send button is disabled when to or subject is empty', () => {
    render(<ComposeModal onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Senden/ })).toBeDisabled();
  });

  it('calls onClose when X is clicked', () => {
    const onClose = vi.fn();
    render(<ComposeModal onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls sendEmail and closes on successful send', async () => {
    const onClose = vi.fn();
    const onSent = vi.fn();
    vi.mocked(emailApi.sendEmail).mockResolvedValue({ emailId: 'new-id' });

    render(
      <ComposeModal
        defaultTo="alice@acme.com"
        defaultSubject="Hello"
        onClose={onClose}
        onSent={onSent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Senden/ }));

    await waitFor(() => {
      expect(emailApi.sendEmail).toHaveBeenCalled();
      expect(onSent).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error message when send fails', async () => {
    vi.mocked(emailApi.sendEmail).mockRejectedValue(new Error('Network error'));

    render(<ComposeModal defaultTo="alice@acme.com" defaultSubject="Hello" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Senden/ }));

    await waitFor(() => {
      expect(screen.getByText(/Senden fehlgeschlagen/)).toBeInTheDocument();
    });
  });
});
