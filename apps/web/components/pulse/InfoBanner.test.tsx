import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InfoBanner } from './InfoBanner';

const STORAGE_KEY = 'pulse.banner_dismissed';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('InfoBanner', () => {
  it('renders after mount when not dismissed', async () => {
    const { findByRole } = render(<InfoBanner itemCount={5} />);
    const banner = await findByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('5');
  });

  it('does not render when previously dismissed', async () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const { queryByRole } = render(<InfoBanner itemCount={5} />);
    // Immediately after render the component reads localStorage
    // and should not display
    await Promise.resolve(); // flush effect
    expect(queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses on close button click and persists to localStorage', async () => {
    const { findByRole, queryByRole } = render(<InfoBanner itemCount={3} />);
    const banner = await findByRole('status');
    expect(banner).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /banner schließen/i });
    fireEvent.click(closeBtn);

    expect(queryByRole('status')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('shows singular "Task" when count is 1', async () => {
    const { findByRole } = render(<InfoBanner itemCount={1} />);
    const banner = await findByRole('status');
    expect(banner).toHaveTextContent('1');
    expect(banner).toHaveTextContent('Task');
  });
});
