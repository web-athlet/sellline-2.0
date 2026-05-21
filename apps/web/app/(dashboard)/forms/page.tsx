'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { deleteForm, formsKeys, listForms, updateForm } from '@/lib/leads-api';

export default function FormsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const formsQuery = useQuery({
    queryKey: formsKeys.list(),
    queryFn: () => listForms(token),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateForm(id, { isActive }, token),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: formsKeys.all() }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForm(id, token),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: formsKeys.all() }),
  });

  const forms = formsQuery.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Webformulare</h1>
          <p className="mt-0.5 text-sm text-slate-500">{forms.length} Formulare</p>
        </div>
        <Link
          href="/forms/builder"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Neues Formular
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {formsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center text-slate-400">
            Lade Formulare...
          </div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-400">
            <ClipboardList className="h-12 w-12" />
            <p className="text-center">
              Noch keine Formulare vorhanden.
              <br />
              Erstelle dein erstes Webformular.
            </p>
            <Link
              href="/forms/builder"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Formular erstellen
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {forms.map((form) => (
              <div
                key={form.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-slate-900">{form.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {form.submissions} Einreichungen · {(form.schemaJson as unknown[]).length}{' '}
                      Felder
                    </p>
                  </div>
                  <button
                    onClick={() => toggleMutation.mutate({ id: form.id, isActive: !form.isActive })}
                    title={form.isActive ? 'Deaktivieren' : 'Aktivieren'}
                    className="shrink-0 text-slate-400 hover:text-slate-700"
                  >
                    {form.isActive ? (
                      <ToggleRight className="h-5 w-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/forms/builder/${form.id}`}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Bearbeiten
                  </Link>
                  <Link
                    href={`/f/${form.id}`}
                    target="_blank"
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Vorschau
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('Formular wirklich löschen?')) deleteMutation.mutate(form.id);
                    }}
                    className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
