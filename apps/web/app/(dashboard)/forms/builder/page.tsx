'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { FormBuilder } from '@/components/forms/FormBuilder';
import { createForm, type FormField } from '@/lib/leads-api';

export default function NewFormPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const router = useRouter();

  const [name, setName] = useState('Neues Formular');
  const [fields, setFields] = useState<FormField[]>([]);
  const [notifyEmails, setNotifyEmails] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createForm(
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
    onSuccess: (form) => {
      router.push(`/forms/builder/${form.id}`);
    },
  });

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
          <div>
            <label className="sr-only">Benachrichtigungs-E-Mails</label>
            <input
              type="text"
              value={notifyEmails}
              onChange={(e) => setNotifyEmails(e.target.value)}
              placeholder="E-Mails (kommagetrennt)"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || name.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {createMutation.isPending ? 'Speichere...' : 'Speichern'}
          </button>
        </div>
      </div>

      {createMutation.isError && (
        <div className="bg-red-50 px-8 py-2 text-sm text-red-600">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : 'Fehler beim Speichern'}
        </div>
      )}

      {/* Builder */}
      <div className="flex-1 overflow-hidden p-6">
        <FormBuilder initialFields={[]} onChange={setFields} />
      </div>
    </div>
  );
}
