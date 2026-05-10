'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api-client';

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!session) return <p>Bitte einloggen.</p>;

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setSuccess('Passwort geändert. Du wirst gleich neu eingeloggt.');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const logoutAll = async () => {
    if (!session.accessToken) return;
    await apiFetch('/api/v1/auth/logout-all', { method: 'POST', accessToken: session.accessToken });
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <div className="mx-auto max-w-xl p-8 space-y-8">
      <h1 className="text-2xl font-semibold">Sicherheit</h1>

      <section>
        <h2 className="text-lg font-medium mb-2">Zwei-Faktor-Authentifizierung</h2>
        <p className="text-sm text-slate-700 mb-2">
          Status: <strong>{session.user?.twoFactorEnabled ? 'aktiv' : 'inaktiv'}</strong>
        </p>
        {!session.user?.twoFactorEnabled && (
          <Link href="/2fa-setup" className="text-sm text-indigo-600 hover:underline">
            Jetzt einrichten
          </Link>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Passwort ändern</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <input
            type="password"
            placeholder="Aktuelles Passwort"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="password"
            placeholder="Neues Passwort"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? '…' : 'Passwort speichern'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Sessions</h2>
        <button
          onClick={logoutAll}
          className="rounded border border-rose-300 px-4 py-2 text-rose-700 hover:bg-rose-50"
        >
          Alle Sessions abmelden
        </button>
      </section>
    </div>
  );
}
