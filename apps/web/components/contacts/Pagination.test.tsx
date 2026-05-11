import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when pages <= 1', () => {
    const { container } = render(
      <Pagination page={1} pages={1} total={20} limit={25} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows range and total', () => {
    render(<Pagination page={1} pages={3} total={70} limit={25} onPageChange={vi.fn()} />);
    expect(screen.getByText(/1–25 von 70/)).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(<Pagination page={1} pages={3} total={70} limit={25} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Vorherige Seite')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<Pagination page={3} pages={3} total={70} limit={25} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Nächste Seite')).toBeDisabled();
  });

  it('calls onPageChange with correct page on next click', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pages={5} total={100} limit={25} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Nächste Seite'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with correct page on prev click', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} pages={5} total={100} limit={25} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Vorherige Seite'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('marks current page with aria-current', () => {
    render(<Pagination page={2} pages={4} total={100} limit={25} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Seite 2')).toHaveAttribute('aria-current', 'page');
  });

  it('calls onPageChange when a page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pages={4} total={100} limit={25} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Seite 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders windowed pages when total pages > 7 and current page near end', () => {
    render(<Pagination page={10} pages={12} total={300} limit={25} onPageChange={vi.fn()} />);
    // Should show at most 7 page buttons
    const pageButtons = screen.getAllByLabelText(/^Seite \d+$/);
    expect(pageButtons.length).toBeLessThanOrEqual(7);
  });
});
