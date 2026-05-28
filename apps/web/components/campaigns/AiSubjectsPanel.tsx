'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { AiSubjectSuggestion } from '@/lib/campaigns-api';

interface AiSubjectsPanelProps {
  suggestions: AiSubjectSuggestion[];
  isLoading: boolean;
  onSelect: (subject: string) => void;
  onGenerate: () => void;
}

export function AiSubjectsPanel({
  suggestions,
  isLoading,
  onSelect,
  onGenerate,
}: AiSubjectsPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (idx: number, subject: string) => {
    setSelected(idx);
    onSelect(subject);
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-900">KI-Betreffzeilen</span>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isLoading}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {isLoading
            ? 'Generiere…'
            : suggestions.length > 0
              ? 'Neu generieren'
              : '3 Vorschläge generieren'}
        </button>
      </div>

      {isLoading && (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-indigo-100" />
          ))}
        </div>
      )}

      {!isLoading && suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i, s.subject)}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                selected === i
                  ? 'border-indigo-500 bg-white ring-1 ring-indigo-500'
                  : 'border-indigo-200 bg-white hover:border-indigo-400'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">{s.subject}</span>
                <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                  ~{s.estimatedOpenRate}%
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{s.reasoning}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
