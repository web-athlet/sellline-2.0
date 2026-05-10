'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch {
      // Anti-enumeration: same UI regardless of outcome.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <>
        <h2 className="text-lg font-medium mb-4">E-Mail verschickt</h2>
        <p className="text-sm text-slate-700">
          Wenn ein Konto zu dieser E-Mail existiert, wurde ein Reset-Link versendet. Der Link ist 1
          Stunde gültig.
        </p>
        <Link href="/login" className="mt-6 block text-sm text-indigo-600 hover:underline">
          Zurück zum Login
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 className="text-lg font-medium mb-4">Passwort zurücksetzen</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-700">E-Mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Reset-Link anfordern'}
        </button>
      </form>
      <Link href="/login" className="mt-6 block text-sm text-slate-600 hover:underline">
        Zurück zum Login
      </Link>
    </>
  );
}
