'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Code2, ExternalLink, Save } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { FormBuilder } from '@/components/forms/FormBuilder';
import { formsKeys, getForm, getFormEmbed, updateForm, type FormField } from '@/lib/leads-api';

export default function EditFormPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [notifyEmails, setNotifyEmails] = useState('');
  const [showEmbed, setShowEmbed] = useState(false);

  const formQuery = useQuery({
    queryKey: formsKeys.detail(id),
    queryFn: () => getForm(id, token),
    enabled: Boolean(token) && Boolean(id),
    staleTime: 30_000,
  });

  const embedQuery = useQuery({
    queryKey: formsKeys.embed(id),
    queryFn: () => getFormEmbed(id, token),
    enabled: Boolean(token) && Boolean(id) && showEmbed,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (formQuery.data) {
      setName(formQuery.data.name);
      setFields(formQuery.data.schemaJson as FormField[]);
      setNotifyEmails(formQuery.data.notifyEmails.join(', '));
    }
  }, [formQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateForm(
        id,
        {
          name,
          schemaJson: fields,
          notifyEmails: notifyEmails
            .split(',')
            .map((e) => e.trim())
            .filter((e) => e.length > 0),
        },
        token,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: formsKeys.detail(id) });
    },
  });

  if (formQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">Lade Formular...</div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-8 py-4">
        <Link
          href="/forms"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          aria-label="Zurück"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border-0 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 px-2 py-1"
        />
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={notifyEmails}
            onChange={(e) => setNotifyEmails(e.target.value)}
            placeholder="E-Mails (kommagetrennt)"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            onClick={() => setShowEmbed((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Code2 className="h-4 w-4" />
            Embed
          </button>
          <Link
            href={`/f/${id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            Vorschau
          </Link>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || name.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>

      {updateMutation.isSuccess && (
        <div className="bg-green-50 px-8 py-2 text-sm text-green-700">Formular gespeichert.</div>
      )}

      {/* Embed snippet */}
      {showEmbed && embedQuery.data && (
        <div className="border-b border-slate-200 bg-slate-50 px-8 py-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Einbettungscode:</p>
          <pre className="overflow-x-auto rounded-lg bg-slate-800 p-3 text-xs text-slate-100">
            {embedQuery.data.snippet}
          </pre>
        </div>
      )}

      {/* Builder */}
      <div className="flex-1 overflow-hidden p-6">
        <FormBuilder initialFields={fields} onChange={setFields} />
      </div>
    </div>
  );
}
