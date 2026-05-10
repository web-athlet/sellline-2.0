'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api-client';

interface ValidateResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; role: string; twoFactorEnabled: boolean };
}

export default function TwoFactorChallengePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session && !session.preAuthToken) router.push('/');
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<ValidateResponse>('/api/v1/auth/2fa/validate', {
        method: 'POST',
        accessToken: session?.preAuthToken,
        body: JSON.stringify({ code }),
      });
      // Re-auth NextAuth via accessToken handoff
      const handoff = await signIn('credentials', {
        accessToken: result.accessToken,
        redirect: false,
      });
      if (handoff?.error) {
        setError('2FA-Code war ok, aber Session-Handoff fehlgeschlagen.');
        return;
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ungültiger Code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-medium mb-4">Zwei-Faktor-Code</h2>
      <p className="mb-4 text-sm text-slate-700">
        Gib den 6-stelligen Code aus deiner Authenticator-App ein.
      </p>
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
          disabled={loading || code.length !== 6}
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Bestätigen'}
        </button>
      </form>
    </>
  );
}
