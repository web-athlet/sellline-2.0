'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Login fehlgeschlagen. Prüfe E-Mail und Passwort.');
      return;
    }
    router.push(params.get('callbackUrl') ?? '/');
  };

  return (
    <>
      <h2 className="text-lg font-medium mb-4">Anmelden</h2>
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
        <label className="block">
          <span className="text-sm text-slate-700">Passwort</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Einloggen'}
        </button>
      </form>

      <div className="mt-6 space-y-2">
        <a
          href={`${API_URL}/api/v1/auth/google`}
          className="block w-full rounded border border-slate-300 px-4 py-2 text-center hover:bg-slate-50"
        >
          Mit Google anmelden
        </a>
        <a
          href={`${API_URL}/api/v1/auth/microsoft`}
          className="block w-full rounded border border-slate-300 px-4 py-2 text-center hover:bg-slate-50"
        >
          Mit Microsoft anmelden
        </a>
      </div>

      <div className="mt-6 flex justify-between text-sm text-slate-600">
        <Link href="/register" className="hover:underline">
          Registrieren
        </Link>
        <Link href="/forgot-password" className="hover:underline">
          Passwort vergessen?
        </Link>
      </div>
    </>
  );
}
