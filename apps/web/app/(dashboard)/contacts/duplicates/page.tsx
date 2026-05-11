'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';
import { DuplicatesList } from '../../../../components/contacts/DuplicateMergePanel';
import { getDuplicates, mergeContacts, type DuplicatePair } from '../../../../lib/contacts-api';

export default function DuplicatesPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergingPair, setMergingPair] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDuplicates(token);
      setPairs(res.data);
    } catch {
      setError('Duplikate konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMerge = useCallback(
    async (masterId: string, duplicateId: string) => {
      const pairKey = [masterId, duplicateId].sort().join('-');
      setMergingPair(pairKey);
      try {
        await mergeContacts(masterId, duplicateId, token);
        // Remove merged pair from list
        setPairs((prev) =>
          prev.filter(
            (p) =>
              !(
                (p.personA.id === masterId || p.personA.id === duplicateId) &&
                (p.personB.id === masterId || p.personB.id === duplicateId)
              ),
          ),
        );
      } catch {
        alert('Zusammenführen fehlgeschlagen.');
      } finally {
        setMergingPair(null);
      }
    },
    [token],
  );

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div>
        <Link
          href="/contacts"
          className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Kontakte
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Duplikate prüfen</h1>
        {!loading && (
          <p className="mt-0.5 text-sm text-slate-500">
            {pairs.length} mögliche Duplikat-Paare gefunden
          </p>
        )}
      </div>

      {loading && (
        <div className="flex h-48 items-center justify-center text-slate-400" role="status">
          Analyse läuft… (kann bei vielen Kontakten etwas dauern)
        </div>
      )}

      {error && (
        <div
          className="rounded-button border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <DuplicatesList pairs={pairs} onMerge={handleMerge} mergingPair={mergingPair} />
      )}
    </div>
  );
}
