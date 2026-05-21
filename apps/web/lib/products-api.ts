import { apiFetch } from './api-client';

export interface Product {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  unit: string | null;
  billingFreq: string | null;
  price: string;
  taxPct: string;
  currency: string;
  visibleFor: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  data: Product[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface ImportResult {
  created: number;
  errors: Array<{ row: number; msg: string }>;
}

export interface CreateProductInput {
  name: string;
  code?: string;
  category?: string;
  unit?: string;
  billingFreq?: string;
  price: number;
  taxPct?: number;
  currency?: string;
  visibleFor?: string[];
}

export interface ProductsQuery {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const buildQs = (params: Record<string, unknown> | ProductsQuery): string => {
  const qs = new URLSearchParams(
    Object.entries(params as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return qs ? `?${qs}` : '';
};

export async function listProducts(
  query: ProductsQuery = {},
  token?: string,
): Promise<ProductsResponse> {
  return apiFetch<ProductsResponse>(`/api/v1/products${buildQs(query)}`, { accessToken: token });
}

export async function getProduct(id: string, token?: string): Promise<Product> {
  return apiFetch<Product>(`/api/v1/products/${id}`, { accessToken: token });
}

export async function createProduct(input: CreateProductInput, token?: string): Promise<Product> {
  return apiFetch<Product>('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function updateProduct(
  id: string,
  input: Partial<CreateProductInput>,
  token?: string,
): Promise<Product> {
  return apiFetch<Product>(`/api/v1/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    accessToken: token,
  });
}

export async function deleteProduct(id: string, token?: string): Promise<void> {
  return apiFetch<void>(`/api/v1/products/${id}`, { method: 'DELETE', accessToken: token });
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function importProductsCsv(file: File, token?: string): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/v1/products/import`, {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(typeof body['message'] === 'string' ? body['message'] : `HTTP ${res.status}`);
  }
  return res.json() as Promise<ImportResult>;
}

export const productsKeys = {
  all: ['products'] as const,
  list: (query: ProductsQuery) => ['products', 'list', query] as const,
  detail: (id: string) => ['products', 'detail', id] as const,
};

export const BILLING_FREQ_LABEL: Record<string, string> = {
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  yearly: 'Jährlich',
  once: 'Einmalig',
};
