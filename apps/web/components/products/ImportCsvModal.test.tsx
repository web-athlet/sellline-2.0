import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImportCsvModal } from './ImportCsvModal';

describe('ImportCsvModal', () => {
  it('renders modal title', () => {
    render(<ImportCsvModal onClose={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText(/csv importieren/i)).toBeInTheDocument();
  });

  it('shows expected CSV columns info', () => {
    render(<ImportCsvModal onClose={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByText(/name \(pflicht\)/i)).toBeInTheDocument();
  });

  it('calls onClose when Abbrechen is clicked', () => {
    const onClose = vi.fn();
    render(<ImportCsvModal onClose={onClose} onImport={vi.fn()} />);
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ImportCsvModal onClose={onClose} onImport={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/schließen/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('import button is disabled when no file is selected', () => {
    render(<ImportCsvModal onClose={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole('button', { name: /importieren/i })).toBeDisabled();
  });

  it('shows file name after file selection', async () => {
    render(<ImportCsvModal onClose={vi.fn()} onImport={vi.fn()} />);
    const input = screen.getByTestId('csv-file-input');
    const file = new File(['name,price\nWidget,10'], 'products.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText('products.csv')).toBeInTheDocument();
    });
  });

  it('enables import button after file selection', async () => {
    render(<ImportCsvModal onClose={vi.fn()} onImport={vi.fn()} />);
    const input = screen.getByTestId('csv-file-input');
    const file = new File(['name,price\nWidget,10'], 'products.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^importieren$/i })).not.toBeDisabled();
    });
  });

  it('shows success result after import', async () => {
    const onImport = vi.fn().mockResolvedValue({ created: 3, errors: [] });
    render(<ImportCsvModal onClose={vi.fn()} onImport={onImport} />);
    const input = screen.getByTestId('csv-file-input');
    const file = new File(['name,price\nW,10\nX,20\nY,30'], 'p.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^importieren$/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^importieren$/i }));
    await waitFor(() => {
      expect(screen.getByText(/3 produkte importiert/i)).toBeInTheDocument();
    });
  });

  it('shows error result with failed rows', async () => {
    const onImport = vi.fn().mockResolvedValue({
      created: 1,
      errors: [{ row: 2, msg: 'name ist erforderlich' }],
    });
    render(<ImportCsvModal onClose={vi.fn()} onImport={onImport} />);
    const input = screen.getByTestId('csv-file-input');
    const file = new File(['name,price\nW,10\n,20'], 'p.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^importieren$/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^importieren$/i }));
    await waitFor(() => {
      expect(screen.getByText(/name ist erforderlich/i)).toBeInTheDocument();
    });
  });

  it('shows error message when import throws', async () => {
    const onImport = vi.fn().mockRejectedValue(new Error('Netzwerkfehler'));
    render(<ImportCsvModal onClose={vi.fn()} onImport={onImport} />);
    const input = screen.getByTestId('csv-file-input');
    const file = new File(['name,price\nW,10'], 'p.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^importieren$/i })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^importieren$/i }));
    await waitFor(() => {
      expect(screen.getByText('Netzwerkfehler')).toBeInTheDocument();
    });
  });
});
