import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactFilters } from './ContactFilters';

const defaultProps = {
  search: '',
  onSearchChange: vi.fn(),
  limit: 25,
  onLimitChange: vi.fn(),
  selectedCount: 0,
  onBulkDelete: vi.fn(),
  onBulkExport: vi.fn(),
};

describe('ContactFilters', () => {
  it('renders search input', () => {
    render(<ContactFilters {...defaultProps} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<ContactFilters {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Max' } });
    expect(onSearchChange).toHaveBeenCalledWith('Max');
  });

  it('shows clear button when search is non-empty', () => {
    render(<ContactFilters {...defaultProps} search="Max" />);
    expect(screen.getByLabelText('Suche leeren')).toBeInTheDocument();
  });

  it('clears search on clear button click', () => {
    const onSearchChange = vi.fn();
    render(<ContactFilters {...defaultProps} search="Max" onSearchChange={onSearchChange} />);
    fireEvent.click(screen.getByLabelText('Suche leeren'));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('does not show clear button when search is empty', () => {
    render(<ContactFilters {...defaultProps} search="" />);
    expect(screen.queryByLabelText('Suche leeren')).not.toBeInTheDocument();
  });

  it('calls onLimitChange when page size changes', () => {
    const onLimitChange = vi.fn();
    render(<ContactFilters {...defaultProps} onLimitChange={onLimitChange} />);
    fireEvent.change(screen.getByLabelText('Einträge pro Seite'), { target: { value: '50' } });
    expect(onLimitChange).toHaveBeenCalledWith(50);
  });

  it('shows bulk actions when items are selected', () => {
    render(<ContactFilters {...defaultProps} selectedCount={3} />);
    expect(screen.getByText('3 ausgewählt')).toBeInTheDocument();
    expect(screen.getByText('CSV Export')).toBeInTheDocument();
    expect(screen.getByText('Löschen')).toBeInTheDocument();
  });

  it('hides bulk actions when nothing selected', () => {
    render(<ContactFilters {...defaultProps} selectedCount={0} />);
    expect(screen.queryByText('ausgewählt')).not.toBeInTheDocument();
  });

  it('calls onBulkExport when export button clicked', () => {
    const onBulkExport = vi.fn();
    render(<ContactFilters {...defaultProps} selectedCount={2} onBulkExport={onBulkExport} />);
    fireEvent.click(screen.getByText('CSV Export'));
    expect(onBulkExport).toHaveBeenCalled();
  });

  it('calls onBulkDelete when delete button clicked', () => {
    const onBulkDelete = vi.fn();
    render(<ContactFilters {...defaultProps} selectedCount={2} onBulkDelete={onBulkDelete} />);
    fireEvent.click(screen.getByText('Löschen'));
    expect(onBulkDelete).toHaveBeenCalled();
  });
});
