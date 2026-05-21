import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductTable } from './ProductTable';
import type { Product } from '@/lib/products-api';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
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
  ...overrides,
});

describe('ProductTable', () => {
  it('renders empty state when no products', () => {
    render(<ProductTable products={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/keine produkte gefunden/i)).toBeInTheDocument();
  });

  it('renders product rows', () => {
    const products = [
      makeProduct(),
      makeProduct({ id: 'prod-2', name: 'Widget Lite', code: null }),
    ];
    render(<ProductTable products={products} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Widget Pro')).toBeInTheDocument();
    expect(screen.getByText('Widget Lite')).toBeInTheDocument();
  });

  it('shows code in column', () => {
    render(<ProductTable products={[makeProduct()]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('WGT-001')).toBeInTheDocument();
  });

  it('shows — for missing code', () => {
    render(
      <ProductTable products={[makeProduct({ code: null })]} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    const product = makeProduct();
    render(<ProductTable products={[product]} onEdit={onEdit} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/widget pro bearbeiten/i));
    expect(onEdit).toHaveBeenCalledWith(product);
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<ProductTable products={[makeProduct()]} onEdit={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText(/widget pro löschen/i));
    expect(onDelete).toHaveBeenCalledWith('prod-1');
  });

  it('shows billing frequency label', () => {
    render(<ProductTable products={[makeProduct()]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Monatlich')).toBeInTheDocument();
  });

  it('shows Alle when visibleFor is empty', () => {
    render(
      <ProductTable
        products={[makeProduct({ visibleFor: [] })]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Alle')).toBeInTheDocument();
  });

  it('renders tax percentage', () => {
    render(<ProductTable products={[makeProduct()]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('19%')).toBeInTheDocument();
  });
});
