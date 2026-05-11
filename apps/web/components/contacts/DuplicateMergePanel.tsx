'use client';

import { AlertTriangle, Check, GitMerge, Mail, Phone } from 'lucide-react';
import { useState } from 'react';
import type { DuplicatePair } from '../../lib/contacts-api';

interface Props {
  pair: DuplicatePair;
  onMerge: (masterId: string, duplicateId: string) => Promise<void>;
  loading?: boolean;
}

export function DuplicateMergePanel({ pair, onMerge, loading }: Props) {
  const [masterId, setMasterId] = useState<string>(pair.personA.id);

  const master = masterId === pair.personA.id ? pair.personA : pair.personB;
  const duplicate = masterId === pair.personA.id ? pair.personB : pair.personA;

  const handleMerge = () => onMerge(master.id, duplicate.id);

  const scoreColor =
    pair.score >= 0.95
      ? 'text-red-600 bg-red-50'
      : pair.score >= 0.9
        ? 'text-orange-600 bg-orange-50'
        : 'text-yellow-600 bg-yellow-50';

  return (
    <div className="rounded-card border border-slate-200 bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Mögliches Duplikat
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor}`}>
          {Math.round(pair.score * 100)}% Übereinstimmung
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[pair.personA, pair.personB].map((person) => {
          const isMaster = person.id === masterId;
          return (
            <label
              key={person.id}
              className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                isMaster
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <input
                  type="radio"
                  name={`master-${pair.personA.id}-${pair.personB.id}`}
                  value={person.id}
                  checked={isMaster}
                  onChange={() => setMasterId(person.id)}
                  className="accent-indigo-600"
                />
                {isMaster && (
                  <span className="flex items-center gap-1 text-xs font-medium text-indigo-600">
                    <Check className="h-3 w-3" /> Master
                  </span>
                )}
              </div>
              <p className="font-semibold text-slate-900">
                {person.firstName} {person.lastName}
              </p>
              {person.emails[0] && (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  {person.emails[0]}
                </p>
              )}
            </label>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Der Master behält seine ID. Deals, Aktivitäten und Kampagnen werden übertragen. Das Duplikat
        wird als &quot;merged&quot; archiviert.
      </p>

      <button
        onClick={handleMerge}
        disabled={loading}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-button bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label={`${master.firstName} ${master.lastName} als Master behalten und zusammenführen`}
      >
        <GitMerge className="h-4 w-4" />
        {loading ? 'Zusammenführen…' : 'Zusammenführen'}
      </button>
    </div>
  );
}

interface DuplicatesListProps {
  pairs: DuplicatePair[];
  onMerge: (masterId: string, duplicateId: string) => Promise<void>;
  mergingPair: string | null;
}

export function DuplicatesList({ pairs, onMerge, mergingPair }: DuplicatesListProps) {
  if (pairs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Check className="mb-3 h-12 w-12 text-green-400" />
        <p className="text-lg font-medium">Keine Duplikate gefunden</p>
        <p className="text-sm">Alle Kontakte sind eindeutig.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pairs.map((pair) => {
        const pairKey = `${pair.personA.id}-${pair.personB.id}`;
        return (
          <DuplicateMergePanel
            key={pairKey}
            pair={pair}
            onMerge={onMerge}
            loading={mergingPair === pairKey}
          />
        );
      })}
    </div>
  );
}

export { Phone };
