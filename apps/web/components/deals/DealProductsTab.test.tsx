import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DealProductsTab } from './DealProductsTab';
import type { DealProductLine } from '@/lib/deals-api';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'tok' } }),
}));

vi.mock('@/lib/products-api', () => ({
  listProducts: vi.fn().mockResolvedValue({ data: [], meta: {} }),
  productsKeys: {
    list: (q: unknown) => ['products', 'list', q],
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn().mockResolvedValue({}),
}));

const makeProduct = (overrides: Partial<DealProductLine> = {}): DealProductLine => ({
  id: 'dp-1',
  productId: 'prod-1',
  quantity: 2,
  unitPrice: '99.00',
  discount: '0',
  discountType: 'PERCENT',
  taxPct: '19.00',
  total: '235.62',
  product: { id: 'prod-1', name: 'Widget Pro', code: 'WGT-001', unit: 'Lizenz' },
  ...overrides,
});

const renderWithQuery = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('DealProductsTab', () => {
  it('renders empty state when no products', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[]} />);
    expect(screen.getByText(/noch keine produkte verknüpft/i)).toBeInTheDocument();
  });

  it('renders product rows', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[makeProduct()]} />);
    expect(screen.getByText('Widget Pro')).toBeInTheDocument();
    expect(screen.getByText('WGT-001')).toBeInTheDocument();
  });

  it('shows quantity and unit price', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[makeProduct()]} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows grand total row when products present', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[makeProduct()]} />);
    expect(screen.getByText('Gesamtsumme:')).toBeInTheDocument();
  });

  it('shows "Produkt hinzufügen" button', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[]} />);
    expect(screen.getByText(/produkt hinzufügen/i)).toBeInTheDocument();
  });

  it('reveals add form on button click', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[]} />);
    fireEvent.click(screen.getByText(/produkt hinzufügen/i));
    expect(screen.getByText(/produkt suchen/i)).toBeInTheDocument();
  });

  it('shows cancel button in add form', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[]} />);
    fireEvent.click(screen.getByText(/produkt hinzufügen/i));
    expect(screen.getByText(/abbrechen/i)).toBeInTheDocument();
  });

  it('hides add form when cancel is clicked', () => {
    renderWithQuery(<DealProductsTab dealId="deal-1" products={[]} />);
    fireEvent.click(screen.getByText(/produkt hinzufügen/i));
    fireEvent.click(screen.getByText(/abbrechen/i));
    expect(screen.queryByText(/produkt suchen/i)).not.toBeInTheDocument();
  });

  it('shows remove button for each product', () => {
    const products = [makeProduct(), makeProduct({ id: 'dp-2', productId: 'prod-2' })];
    renderWithQuery(<DealProductsTab dealId="deal-1" products={products} />);
    const removeButtons = screen.getAllByLabelText(/produkt entfernen/i);
    expect(removeButtons).toHaveLength(2);
  });
});
