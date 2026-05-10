'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackInner />
    </Suspense>
  );
}

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const accessToken = params.get('at');

  useEffect(() => {
    if (!accessToken) {
      router.push('/login?error=oauth');
      return;
    }
    void (async () => {
      const result = await signIn('credentials', { accessToken, redirect: false });
      router.push(result?.error ? '/login?error=oauth' : '/');
    })();
  }, [accessToken, router]);

  return <p className="text-sm text-slate-600">Anmeldung wird abgeschlossen…</p>;
}
