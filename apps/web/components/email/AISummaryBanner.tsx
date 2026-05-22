'use client';

import { cn } from '@nextgen/utils';
import { Bot, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { AISummary } from '@/lib/email-api';

const TONE_STYLES: Record<string, string> = {
  friendly: 'bg-green-50 border-green-200 text-green-800',
  neutral: 'bg-blue-50 border-blue-200 text-blue-800',
  urgent: 'bg-red-50 border-red-200 text-red-800',
};

const TONE_LABELS: Record<string, string> = {
  friendly: 'Freundlich',
  neutral: 'Neutral',
  urgent: 'Dringend',
};

interface Props {
  threadId: string;
  emailCount: number;
  summary: AISummary | null;
  isLoading: boolean;
  onLoad: () => void;
  onDraftReply: (draft: string) => void;
}

export function AISummaryBanner({ emailCount, summary, isLoading, onLoad, onDraftReply }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (emailCount < 5) return null;
  if (summary?.skipped) return null;

  if (!summary && !isLoading) {
    return (
      <div className="mx-4 mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Bot className="h-4 w-4" />
          <span>KI-Zusammenfassung für {emailCount} E-Mails verfügbar</span>
        </div>
        <button
          onClick={onLoad}
          className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
        >
          Anzeigen
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-4 mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50 flex items-center gap-2 text-sm text-blue-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>KI analysiert Thread…</span>
      </div>
    );
  }

  if (!summary) return null;

  const toneStyle = TONE_STYLES[summary.tone] ?? TONE_STYLES.neutral;

  return (
    <div className={cn('mx-4 mt-4 rounded-lg border p-3', toneStyle)}>
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-label="KI-Zusammenfassung ein/ausklappen"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="text-sm font-semibold">KI-Zusammenfassung</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full border text-current opacity-70">
            {TONE_LABELS[summary.tone] ?? summary.tone}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <ul className="space-y-1">
            {summary.bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="opacity-60">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {summary.suggestedReply && (
            <div className="pt-2 border-t border-current/20">
              <p className="text-xs font-medium mb-1 opacity-70">Vorgeschlagene Antwort</p>
              <p className="text-sm opacity-80 line-clamp-3">{summary.suggestedReply}</p>
              <button
                onClick={() => onDraftReply(summary.suggestedReply!)}
                className="mt-2 text-xs font-medium underline hover:opacity-70"
              >
                Als Entwurf laden
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
