import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  importProductsCsv,
  productsKeys,
  BILLING_FREQ_LABEL,
} from './products-api';
import * as apiClient from './api-client';

vi.mock('./api-client');

const mockApiFetch = vi.mocked(apiClient.apiFetch);

const makeProduct = (overrides = {}) => ({
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

describe('products-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listProducts', () => {
    it('calls correct endpoint with no query', async () => {
      mockApiFetch.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 50, pages: 0 },
      });
      await listProducts();
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/products', expect.anything());
    });

    it('builds query string from filters', async () => {
      mockApiFetch.mockResolvedValue({ data: [], meta: {} });
      await listProducts({ category: 'Software', search: 'Widget', page: 2, limit: 20 }, 'tok');
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=Software'),
        expect.anything(),
      );
    });

    it('passes accessToken', async () => {
      mockApiFetch.mockResolvedValue({ data: [], meta: {} });
      await listProducts({}, 'my-token');
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ accessToken: 'my-token' }),
      );
    });
  });

  describe('getProduct', () => {
    it('calls correct endpoint', async () => {
      mockApiFetch.mockResolvedValue(makeProduct());
      await getProduct('prod-1', 'tok');
      expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/products/prod-1', expect.anything());
    });
  });

  describe('createProduct', () => {
    it('sends POST with body', async () => {
      mockApiFetch.mockResolvedValue(makeProduct());
      await createProduct({ name: 'Widget', price: 99 }, 'tok');
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/v1/products',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Widget', price: 99 }),
        }),
      );
    });
  });

  describe('updateProduct', () => {
    it('sends PATCH with partial body', async () => {
      mockApiFetch.mockResolvedValue(makeProduct({ name: 'Widget v2' }));
      await updateProduct('prod-1', { name: 'Widget v2' }, 'tok');
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/v1/products/prod-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteProduct', () => {
    it('sends DELETE', async () => {
      mockApiFetch.mockResolvedValue(undefined);
      await deleteProduct('prod-1', 'tok');
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/v1/products/prod-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('importProductsCsv', () => {
    it('throws on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad CSV' }),
      });
      const file = new File(['name,price'], 'test.csv', { type: 'text/csv' });
      await expect(importProductsCsv(file)).rejects.toThrow('Bad CSV');
    });

    it('returns ImportResult on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ created: 5, errors: [] }),
      });
      const file = new File(['name,price\nW,10'], 'test.csv', { type: 'text/csv' });
      const result = await importProductsCsv(file, 'tok');
      expect(result.created).toBe(5);
    });
  });

  describe('productsKeys', () => {
    it('has stable key structure', () => {
      expect(productsKeys.all).toEqual(['products']);
      expect(productsKeys.list({})).toEqual(['products', 'list', {}]);
      expect(productsKeys.detail('p1')).toEqual(['products', 'detail', 'p1']);
    });
  });

  describe('BILLING_FREQ_LABEL', () => {
    it('has label for monthly', () => {
      expect(BILLING_FREQ_LABEL['monthly']).toBe('Monatlich');
    });
  });
});
