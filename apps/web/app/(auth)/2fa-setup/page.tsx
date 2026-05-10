'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api-client';

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = session?.setupToken ?? session?.accessToken;

  useEffect(() => {
    if (!token) return;
    const path = session?.setupToken
      ? '/api/v1/auth/2fa/setup-generate'
      : '/api/v1/auth/2fa/generate';
    apiFetch<{ qrCodeDataUrl: string }>(path, { method: 'POST', accessToken: token })
      .then((r) => setQrDataUrl(r.qrCodeDataUrl))
      .catch((err) => setError(err instanceof Error ? err.message : 'Setup fehlgeschlagen'));
  }, [token, session?.setupToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      if (session?.setupToken) {
        const result = await apiFetch<{ accessToken: string }>('/api/v1/auth/2fa/setup-verify', {
          method: 'POST',
          accessToken: session.setupToken,
          body: JSON.stringify({ code }),
        });
        const handoff = await signIn('credentials', {
          accessToken: result.accessToken,
          redirect: false,
        });
        if (handoff?.error) throw new Error('Session-Handoff fehlgeschlagen');
        router.push('/');
        return;
      }
      await apiFetch('/api/v1/auth/2fa/verify', {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({ code }),
      });
      router.push('/settings/security');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code ungültig');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-medium mb-4">Zwei-Faktor-Authentifizierung einrichten</h2>
      <ol className="mb-4 text-sm text-slate-700 list-decimal pl-5 space-y-1">
        <li>Öffne deine Authenticator-App (Google Authenticator, Authy, …).</li>
        <li>Scanne den QR-Code unten.</li>
        <li>Trage den 6-stelligen Code ein, um die Einrichtung abzuschließen.</li>
      </ol>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt="2FA QR" className="mx-auto mb-4" />
      ) : (
        <p className="text-sm text-slate-500 mb-4">QR-Code wird geladen…</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          required
          minLength={6}
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded border border-slate-300 px-3 py-2 text-center text-lg tracking-widest"
          placeholder="123456"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || code.length !== 6 || !token}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Aktivieren'}
        </button>
      </form>
    </>
  );
}
