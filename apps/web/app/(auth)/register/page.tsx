'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import zxcvbn from 'zxcvbn';
import { apiFetch } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => (password ? zxcvbn(password).score : 0), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('Registrierung erfolgreich, automatisches Einloggen fehlgeschlagen.');
        return;
      }
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registrierung fehlgeschlagen';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const strengthBars = ['', 'sehr schwach', 'schwach', 'okay', 'stark', 'sehr stark'];
  const strengthColor = [
    '',
    'bg-rose-400',
    'bg-orange-400',
    'bg-amber-400',
    'bg-emerald-400',
    'bg-emerald-600',
  ];

  return (
    <>
      <h2 className="text-lg font-medium mb-4">Konto anlegen</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-700">Name</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
          {password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded bg-slate-200 overflow-hidden">
                <div
                  className={`h-full ${strengthColor[strength + 1]}`}
                  style={{ width: `${(strength + 1) * 20}%` }}
                />
              </div>
              <span className="text-xs text-slate-600">{strengthBars[strength + 1]}</span>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Mind. 8 Zeichen, 1 Großbuchstabe, 1 Ziffer, 1 Sonderzeichen.
          </p>
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Registrieren'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        Schon einen Account?{' '}
        <Link href="/login" className="hover:underline text-indigo-600">
          Einloggen
        </Link>
      </p>
    </>
  );
}
