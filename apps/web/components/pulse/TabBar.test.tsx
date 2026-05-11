import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TabBar } from './TabBar';

const counts = { followups: 3, missed: 1, opportunities: 0 };

describe('TabBar', () => {
  it('renders all three tabs', () => {
    render(<TabBar activeTab="followups" counts={counts} onTabChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /follow-ups/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /übersehene deals/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /verkaufschancen/i })).toBeInTheDocument();
  });

  it('marks active tab with aria-selected=true', () => {
    render(<TabBar activeTab="missed" counts={counts} onTabChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /übersehene deals/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /follow-ups/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('calls onTabChange when tab clicked', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="followups" counts={counts} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /übersehene deals/i }));
    expect(onTabChange).toHaveBeenCalledWith('missed');
  });

  it('shows badge count when > 0', () => {
    render(<TabBar activeTab="followups" counts={counts} onTabChange={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('does not show badge when count is 0', () => {
    render(
      <TabBar
        activeTab="followups"
        counts={{ followups: 0, missed: 0, opportunities: 0 }}
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
