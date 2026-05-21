'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { BILLING_FREQ_LABEL, type Product } from '@/lib/products-api';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

function formatPrice(price: string, currency: string): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(parseFloat(price));
}

export function ProductTable({ products, onEdit, onDelete }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        Keine Produkte gefunden. Erstelle dein erstes Produkt oder importiere eine CSV-Datei.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Kategorie</th>
            <th className="px-4 py-3 text-right">Preis</th>
            <th className="px-4 py-3 text-right">Steuer %</th>
            <th className="px-4 py-3">Einheit</th>
            <th className="px-4 py-3">Abrechnung</th>
            <th className="px-4 py-3">Sichtbar für</th>
            <th className="px-4 py-3 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.code ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{product.category ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                {formatPrice(product.price, product.currency)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                {parseFloat(product.taxPct)}%
              </td>
              <td className="px-4 py-3 text-slate-600">{product.unit ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">
                {product.billingFreq
                  ? (BILLING_FREQ_LABEL[product.billingFreq] ?? product.billingFreq)
                  : '—'}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {product.visibleFor.length > 0 ? product.visibleFor.join(', ') : 'Alle'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(product)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`${product.name} bearbeiten`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(product.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`${product.name} löschen`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
