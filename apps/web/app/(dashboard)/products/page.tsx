'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ImportCsvModal } from '@/components/products/ImportCsvModal';
import { CreateProductModal } from '@/components/products/CreateProductModal';
import { ProductTable } from '@/components/products/ProductTable';
import {
  createProduct,
  deleteProduct,
  importProductsCsv,
  listProducts,
  productsKeys,
  updateProduct,
  type CreateProductInput,
  type Product,
  type ProductsQuery,
} from '@/lib/products-api';

export default function ProductsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [query, setQuery] = useState<ProductsQuery>({ page: 1, limit: 50 });
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: productsKeys.list(query),
    queryFn: () => listProducts(query, token),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsKeys.all });
      setShowCreate(false);
      setMutationError(null);
    },
    onError: (e) => {
      setMutationError(e instanceof Error ? e.message : 'Fehler beim Erstellen');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateProductInput> }) =>
      updateProduct(id, input, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsKeys.all });
      setEditProduct(null);
      setMutationError(null);
    },
    onError: (e) => {
      setMutationError(e instanceof Error ? e.message : 'Fehler beim Aktualisieren');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsKeys.all });
    },
  });

  const handleCreate = async (input: CreateProductInput) => {
    await createMutation.mutateAsync(input);
  };

  const handleUpdate = async (input: CreateProductInput) => {
    if (!editProduct) return;
    await updateMutation.mutateAsync({ id: editProduct.id, input });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Produkt wirklich löschen?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Produktkatalog</h1>
          {productsQuery.data && (
            <p className="mt-1 text-sm text-slate-500">
              {productsQuery.data.meta.total} Produkt
              {productsQuery.data.meta.total !== 1 ? 'e' : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            CSV importieren
          </button>
          <button
            onClick={() => {
              setMutationError(null);
              setShowCreate(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Neues Produkt
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Suchen…"
          value={query.search ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, search: e.target.value || undefined, page: 1 }))
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 w-64"
        />
        <input
          type="text"
          placeholder="Kategorie filtern…"
          value={query.category ?? ''}
          onChange={(e) =>
            setQuery((q) => ({ ...q, category: e.target.value || undefined, page: 1 }))
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 w-48"
        />
      </div>

      {productsQuery.isLoading && (
        <div className="py-12 text-center text-sm text-slate-400">Lade Produkte…</div>
      )}

      {productsQuery.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Fehler beim Laden der Produkte.
        </div>
      )}

      {productsQuery.data && (
        <>
          <ProductTable
            products={productsQuery.data.data}
            onEdit={(p) => {
              setMutationError(null);
              setEditProduct(p);
            }}
            onDelete={handleDelete}
          />

          {productsQuery.data.meta.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={(query.page ?? 1) <= 1}
                onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                ← Zurück
              </button>
              <span className="text-sm text-slate-500">
                Seite {query.page} / {productsQuery.data.meta.pages}
              </span>
              <button
                disabled={(query.page ?? 1) >= productsQuery.data.meta.pages}
                onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Weiter →
              </button>
            </div>
          )}
        </>
      )}

      {(showCreate || editProduct) && (
        <CreateProductModal
          product={editProduct}
          onClose={() => {
            setShowCreate(false);
            setEditProduct(null);
            setMutationError(null);
          }}
          onSubmit={editProduct ? handleUpdate : handleCreate}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={mutationError}
        />
      )}

      {showImport && (
        <ImportCsvModal
          onClose={() => {
            setShowImport(false);
            void queryClient.invalidateQueries({ queryKey: productsKeys.all });
          }}
          onImport={(file) => importProductsCsv(file, token)}
        />
      )}
    </div>
  );
}
