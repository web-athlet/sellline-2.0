'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      router.push('/login?reset=ok');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ungültiger oder abgelaufener Link.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <h2 className="text-lg font-medium mb-4">Ungültiger Link</h2>
        <p className="text-sm text-slate-700">Es fehlt der Reset-Token.</p>
        <Link
          href="/forgot-password"
          className="mt-6 block text-sm text-indigo-600 hover:underline"
        >
          Neuen Link anfordern
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 className="text-lg font-medium mb-4">Neues Passwort setzen</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-700">Neues Passwort</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-700">Bestätigung</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Passwort speichern'}
        </button>
      </form>
    </>
  );
}
