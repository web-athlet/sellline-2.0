'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { submitPublicForm, type FormField } from '@/lib/leads-api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface PublicFormSchema {
  id: string;
  name: string;
  schemaJson: FormField[];
}

export default function PublicFormPage() {
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<PublicFormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/forms/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Formular nicht gefunden');
        return r.json() as Promise<PublicFormSchema>;
      })
      .then((data) => {
        setForm(data);
        // Initialise values with defaults
        const init: Record<string, string> = {};
        (data.schemaJson as FormField[]).forEach((f) => {
          init[f.id] = f.defaultValue ?? '';
        });
        setValues(init);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unbekannter Fehler'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setSubmitError(null);

    // Build data map using field labels as keys (human-readable)
    const data: Record<string, unknown> = {};
    (form.schemaJson as FormField[]).forEach((f) => {
      data[f.label] = values[f.id] ?? '';
    });

    try {
      await submitPublicForm(id, data);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Einreichung fehlgeschlagen. Bitte erneut versuchen.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">Lade Formular...</p>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-red-500">{error ?? 'Formular nicht verfügbar.'}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6">
        <CheckCircle className="h-14 w-14 text-green-500" />
        <h2 className="text-xl font-semibold text-slate-900">Vielen Dank!</h2>
        <p className="text-center text-slate-500">
          Deine Anfrage wurde erfolgreich übermittelt. Wir melden uns in Kürze.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 p-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{form.name}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-8 shadow-sm">
          {(form.schemaJson as FormField[]).map((field) => (
            <FormFieldInput
              key={field.id}
              field={field}
              value={values[field.id] ?? ''}
              onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
            />
          ))}

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Wird übermittelt...' : 'Absenden'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Field renderer ────────────────────────────────────────────────────────────

interface FormFieldInputProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
}

function FormFieldInput({ field, value, onChange }: FormFieldInputProps) {
  const baseClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

  const label = (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {field.label}
      {field.required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );

  switch (field.type) {
    case 'textarea':
      return (
        <div>
          {label}
          <textarea
            rows={4}
            required={field.required}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          />
        </div>
      );

    case 'dropdown':
      return (
        <div>
          {label}
          <select
            required={field.required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          >
            <option value="">Bitte wählen...</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    case 'radio':
      return (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-slate-700">
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </legend>
          <div className="space-y-1.5">
            {(field.options ?? []).map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  required={field.required}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="h-4 w-4 text-indigo-600"
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      );

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            required={field.required}
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </label>
      );

    case 'file':
      return (
        <div>
          {label}
          <input
            type="file"
            required={field.required}
            onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
            className="w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
      );

    default:
      return (
        <div>
          {label}
          <input
            type={
              field.type === 'tel'
                ? 'tel'
                : field.type === 'number'
                  ? 'number'
                  : field.type === 'date'
                    ? 'date'
                    : 'text'
            }
            required={field.required}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          />
        </div>
      );
  }
}
