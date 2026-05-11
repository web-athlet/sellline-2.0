import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DayNav } from './DayNav';

describe('DayNav', () => {
  it('renders "Heute" for today\'s date', () => {
    const today = new Date().toISOString().slice(0, 10);
    render(<DayNav date={today} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText('Heute')).toBeInTheDocument();
  });

  it('calls onPrev when left arrow clicked', () => {
    const onPrev = vi.fn();
    render(<DayNav date="2026-05-10" onPrev={onPrev} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /vorheriger tag/i }));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('calls onNext when right arrow clicked on past date', () => {
    const onNext = vi.fn();
    render(<DayNav date="2026-05-10" onPrev={vi.fn()} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: /nächster tag/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('disables next button for today', () => {
    const today = new Date().toISOString().slice(0, 10);
    render(<DayNav date={today} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /nächster tag/i })).toBeDisabled();
  });
});
