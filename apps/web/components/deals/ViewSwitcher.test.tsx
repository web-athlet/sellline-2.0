import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from './ViewSwitcher';

describe('ViewSwitcher', () => {
  it('renders all four tabs', () => {
    render(<ViewSwitcher value="kanban" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /kanban/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /liste/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tabelle/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /zeitachse/i })).toBeInTheDocument();
  });

  it('marks the active tab', () => {
    render(<ViewSwitcher value="table" onChange={() => {}} />);
    const tab = screen.getByRole('tab', { name: /tabelle/i });
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('emits onChange when a different tab is clicked', () => {
    const onChange = vi.fn();
    render(<ViewSwitcher value="kanban" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /liste/i }));
    expect(onChange).toHaveBeenCalledWith('list');
  });
});
