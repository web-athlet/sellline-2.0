'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type CreateProductInput, type Product } from '@/lib/products-api';

const BILLING_FREQ_OPTIONS = [
  { value: '', label: 'Keine Angabe' },
  { value: 'once', label: 'Einmalig' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'quarterly', label: 'Vierteljährlich' },
  { value: 'yearly', label: 'Jährlich' },
];

const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'SALES_REP'];

interface CreateProductModalProps {
  product?: Product | null;
  onClose: () => void;
  onSubmit: (input: CreateProductInput) => Promise<void>;
  isPending?: boolean;
  error?: string | null;
}

export function CreateProductModal({
  product,
  onClose,
  onSubmit,
  isPending,
  error,
}: CreateProductModalProps) {
  const isEdit = Boolean(product);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [billingFreq, setBillingFreq] = useState('');
  const [price, setPrice] = useState('');
  const [taxPct, setTaxPct] = useState('19');
  const [currency, setCurrency] = useState('EUR');
  const [visibleFor, setVisibleFor] = useState<string[]>([]);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCode(product.code ?? '');
      setCategory(product.category ?? '');
      setUnit(product.unit ?? '');
      setBillingFreq(product.billingFreq ?? '');
      setPrice(product.price);
      setTaxPct(product.taxPct);
      setCurrency(product.currency);
      setVisibleFor(product.visibleFor);
    } else {
      setName('');
      setCode('');
      setCategory('');
      setUnit('');
      setBillingFreq('');
      setPrice('');
      setTaxPct('19');
      setCurrency('EUR');
      setVisibleFor([]);
    }
  }, [product]);

  const toggleRole = (role: string) => {
    setVisibleFor((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(price);
    const taxNum = parseFloat(taxPct) || 0;
    if (isNaN(priceNum) || priceNum < 0) return;

    await onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
      category: category.trim() || undefined,
      unit: unit.trim() || undefined,
      billingFreq: billingFreq || undefined,
      price: priceNum,
      taxPct: taxNum,
      currency: currency || 'EUR',
      visibleFor: visibleFor.length > 0 ? visibleFor : undefined,
    });
  };

  const canSubmit = name.trim().length > 0 && price.length > 0 && !isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Produkt bearbeiten' : 'Neues Produkt'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="z.B. CRM Pro Lizenz"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Artikel-Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="z.B. CRM-PRO-001"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Kategorie</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="z.B. Software"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Einheit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="z.B. Lizenz, Stück, Stunde"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Abrechnungsfrequenz
              </label>
              <select
                value={billingFreq}
                onChange={(e) => setBillingFreq(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {BILLING_FREQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Stückpreis <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                step="0.01"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Steuer %</label>
              <input
                type="number"
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="19"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Währung</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="EUR">EUR</option>
                <option value="CHF">CHF</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Sichtbar für</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    visibleFor.includes(role)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
            {visibleFor.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">Keine Auswahl = sichtbar für alle</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isPending ? 'Speichern…' : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
