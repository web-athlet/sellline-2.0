import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateProductModal } from './CreateProductModal';
import type { Product } from '@/lib/products-api';

const makeProduct = (): Product => ({
  id: 'prod-1',
  name: 'Widget Pro',
  code: 'WGT-001',
  category: 'Software',
  unit: 'Lizenz',
  billingFreq: 'monthly',
  price: '99.00',
  taxPct: '19.00',
  currency: 'EUR',
  visibleFor: ['ADMIN'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('CreateProductModal', () => {
  it('renders "Neues Produkt" title in create mode', () => {
    render(
      <CreateProductModal onClose={vi.fn()} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    expect(screen.getByText('Neues Produkt')).toBeInTheDocument();
  });

  it('renders "Produkt bearbeiten" title in edit mode', () => {
    render(
      <CreateProductModal
        product={makeProduct()}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText('Produkt bearbeiten')).toBeInTheDocument();
  });

  it('prefills form fields when editing', () => {
    render(
      <CreateProductModal
        product={makeProduct()}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByDisplayValue('Widget Pro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('WGT-001')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <CreateProductModal onClose={onClose} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireEvent.click(screen.getByLabelText(/schließen/i));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Abbrechen is clicked', () => {
    const onClose = vi.fn();
    render(
      <CreateProductModal onClose={onClose} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submit button is disabled when name or price is empty', () => {
    render(
      <CreateProductModal onClose={vi.fn()} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    expect(screen.getByRole('button', { name: /erstellen/i })).toBeDisabled();
  });

  it('submit button is enabled when name and price are set', () => {
    render(
      <CreateProductModal onClose={vi.fn()} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/z\.b\. crm pro/i), {
      target: { value: 'New Product' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '49' } });
    expect(screen.getByRole('button', { name: /erstellen/i })).not.toBeDisabled();
  });

  it('shows error message when error prop is set', () => {
    render(
      <CreateProductModal
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        error="Code bereits vergeben"
      />,
    );
    expect(screen.getByText('Code bereits vergeben')).toBeInTheDocument();
  });

  it('shows "Speichern…" label when isPending', () => {
    render(
      <CreateProductModal
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        isPending
      />,
    );
    expect(screen.getByText('Speichern…')).toBeInTheDocument();
  });

  it('toggles role selection', () => {
    render(
      <CreateProductModal onClose={vi.fn()} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );
    const adminBtn = screen.getByText('ADMIN');
    fireEvent.click(adminBtn);
    expect(adminBtn.className).toContain('bg-indigo-600');
    fireEvent.click(adminBtn);
    expect(adminBtn.className).not.toContain('bg-indigo-600');
  });

  it('calls onSubmit with correct values on form submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateProductModal onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/z\.b\. crm pro/i), {
      target: { value: 'Test Product' },
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '99' } });
    fireEvent.submit(screen.getByRole('button', { name: /erstellen/i }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Product', price: 99 }),
    );
  });
});
