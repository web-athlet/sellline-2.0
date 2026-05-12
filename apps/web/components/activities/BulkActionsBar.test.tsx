import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BulkActionsBar } from './BulkActionsBar';

describe('BulkActionsBar', () => {
  it('renders nothing when no items selected', () => {
    const { container } = render(
      <BulkActionsBar selected={[]} onClear={vi.fn()} onMarkDone={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows selected count', () => {
    render(
      <BulkActionsBar
        selected={['a', 'b', 'c']}
        onClear={vi.fn()}
        onMarkDone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/3 ausgewählt/i)).toBeTruthy();
  });

  it('calls onMarkDone with selected ids', () => {
    const onMarkDone = vi.fn();
    render(
      <BulkActionsBar
        selected={['id-1', 'id-2']}
        onClear={vi.fn()}
        onMarkDone={onMarkDone}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/erledigt/i));
    expect(onMarkDone).toHaveBeenCalledWith(['id-1', 'id-2']);
  });

  it('calls onDelete with selected ids', () => {
    const onDelete = vi.fn();
    render(
      <BulkActionsBar
        selected={['id-1']}
        onClear={vi.fn()}
        onMarkDone={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText(/löschen/i));
    expect(onDelete).toHaveBeenCalledWith(['id-1']);
  });

  it('calls onClear when X clicked', () => {
    const onClear = vi.fn();
    render(
      <BulkActionsBar
        selected={['id-1']}
        onClear={onClear}
        onMarkDone={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    // The X button is the last button in the bar
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]!);
    expect(onClear).toHaveBeenCalled();
  });
});
