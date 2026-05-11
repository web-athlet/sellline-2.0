import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SnoozeGhostingModal } from './SnoozeGhostingModal';

describe('SnoozeGhostingModal', () => {
  it('defaults to 7-day preset', () => {
    render(
      <SnoozeGhostingModal onClose={() => {}} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    expect(screen.getByRole('button', { name: /pausieren \(7\)/i })).toBeInTheDocument();
  });

  it('updates days when a preset is clicked', () => {
    render(
      <SnoozeGhostingModal onClose={() => {}} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '30 Tage' }));
    expect(screen.getByRole('button', { name: /pausieren \(30\)/i })).toBeInTheDocument();
  });

  it('submits with selected days and closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<SnoozeGhostingModal onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: '14 Tage' }));
    fireEvent.click(screen.getByRole('button', { name: /pausieren \(14\)/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(14));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<SnoozeGhostingModal onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalled();
  });
});
