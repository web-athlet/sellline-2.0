'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { dealsKeys, type DealProductLine } from '@/lib/deals-api';
import { formatCurrency } from '@/lib/deal-format';
import { listProducts, productsKeys } from '@/lib/products-api';
import { apiFetch } from '@/lib/api-client';

interface DealProductsTabProps {
  dealId: string;
  products: DealProductLine[];
}

interface AddProductForm {
  productId: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  discountType: 'PERCENT' | 'ABSOLUTE';
  taxPct: string;
}

const DEFAULT_FORM: AddProductForm = {
  productId: '',
  quantity: 1,
  unitPrice: '',
  discount: '0',
  discountType: 'PERCENT',
  taxPct: '0',
};

function computeLineTotal(
  unitPrice: number,
  quantity: number,
  discount: number,
  discountType: 'PERCENT' | 'ABSOLUTE',
  taxPct: number,
): number {
  const base = unitPrice * quantity;
  const afterDiscount =
    discountType === 'ABSOLUTE' ? base - discount : base - (base * discount) / 100;
  return afterDiscount + (afterDiscount * taxPct) / 100;
}

export function DealProductsTab({ dealId, products }: DealProductsTabProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddProductForm>(DEFAULT_FORM);
  const [productSearch, setProductSearch] = useState('');

  const catalogQuery = useQuery({
    queryKey: productsKeys.list({ search: productSearch }),
    queryFn: () => listProducts({ search: productSearch || undefined, limit: 20 }, token),
    enabled: showAdd && Boolean(token),
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch<DealProductLine>(`/api/v1/deals/${dealId}/products`, {
        method: 'POST',
        body: JSON.stringify({
          productId: form.productId,
          quantity: form.quantity,
          unitPrice: parseFloat(form.unitPrice),
          discount: parseFloat(form.discount) || 0,
          discountType: form.discountType,
          taxPct: parseFloat(form.taxPct) || 0,
        }),
        accessToken: token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dealsKeys.detail(dealId) });
      setShowAdd(false);
      setForm(DEFAULT_FORM);
      setProductSearch('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (dealProductId: string) =>
      apiFetch<void>(`/api/v1/deals/${dealId}/products/${dealProductId}`, {
        method: 'DELETE',
        accessToken: token,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dealsKeys.detail(dealId) });
    },
  });

  const handleProductSelect = (productId: string) => {
    const product = catalogQuery.data?.data.find((p) => p.id === productId);
    setForm((prev) => ({
      ...prev,
      productId,
      unitPrice: product ? product.price : '',
      taxPct: product ? product.taxPct : '0',
    }));
  };

  const previewTotal =
    form.productId && form.unitPrice
      ? computeLineTotal(
          parseFloat(form.unitPrice) || 0,
          form.quantity,
          parseFloat(form.discount) || 0,
          form.discountType,
          parseFloat(form.taxPct) || 0,
        )
      : null;

  const grandTotal = products.reduce((sum, p) => sum + parseFloat(p.total), 0);
  const currency = products[0]?.product ? 'EUR' : 'EUR';

  const canSubmit =
    form.productId.length > 0 &&
    form.unitPrice.length > 0 &&
    form.quantity >= 1 &&
    !addMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {products.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Noch keine Produkte verknüpft.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase text-slate-500">
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left">Produkt</th>
                <th className="px-4 py-3 text-right">Menge</th>
                <th className="px-4 py-3 text-right">Einzelpreis</th>
                <th className="px-4 py-3 text-right">Rabatt</th>
                <th className="px-4 py-3 text-right">Steuer %</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{p.product.name}</span>
                    {p.product.code && (
                      <span className="ml-2 font-mono text-xs text-slate-400">
                        {p.product.code}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(p.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.discount} {p.discountType === 'PERCENT' ? '%' : '€'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{parseFloat(p.taxPct)}%</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatCurrency(p.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeMutation.mutate(p.id)}
                      disabled={removeMutation.isPending}
                      className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      aria-label="Produkt entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {products.length > 0 && (
        <div className="flex justify-end">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
            <span className="text-slate-500">Gesamtsumme:</span>{' '}
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatCurrency(grandTotal.toString(), currency)}
            </span>
          </div>
        </div>
      )}

      {!showAdd ? (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Produkt hinzufügen
        </button>
      ) : (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Produkt hinzufügen</h3>

          {addMutation.isError && (
            <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
              {addMutation.error instanceof Error
                ? addMutation.error.message
                : 'Fehler beim Hinzufügen'}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-600">
                Produkt suchen <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Name oder Code eingeben…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {catalogQuery.data && catalogQuery.data.data.length > 0 && (
                <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  {catalogQuery.data.data.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handleProductSelect(p.id)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          form.productId === p.id
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-700'
                        }`}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.code && (
                          <span className="ml-2 font-mono text-xs text-slate-400">{p.code}</span>
                        )}
                        <span className="ml-auto float-right text-slate-500">
                          {parseFloat(p.price).toFixed(2)} {p.currency}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {form.productId && (
                <p className="mt-1 text-xs text-indigo-700">
                  Ausgewählt:{' '}
                  {catalogQuery.data?.data.find((p) => p.id === form.productId)?.name ??
                    form.productId}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">Menge</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">Einzelpreis</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">Steuer %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxPct}
                onChange={(e) => setForm((f) => ({ ...f, taxPct: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600">Rabatt</label>
              <div className="mt-1 flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="0"
                />
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discountType: e.target.value as 'PERCENT' | 'ABSOLUTE',
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="PERCENT">%</option>
                  <option value="ABSOLUTE">€</option>
                </select>
              </div>
            </div>

            {previewTotal !== null && (
              <div className="col-span-2 sm:col-span-3 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm">
                <span className="text-slate-500">Zeilentotal (inkl. Steuer):</span>{' '}
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatCurrency(previewTotal.toFixed(2))}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setForm(DEFAULT_FORM);
                setProductSearch('');
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => addMutation.mutate()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {addMutation.isPending ? 'Hinzufügen…' : 'Hinzufügen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
