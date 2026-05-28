'use client';

import { AlertCircle, Brain, RefreshCw, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  getLossInsight,
  insightsKeys,
  triggerLossAnalysis,
  type LossReason,
} from '@/lib/insights-api';

const priorityStyles: Record<string, string> = {
  high: 'border-l-red-500 bg-red-50',
  medium: 'border-l-amber-500 bg-amber-50',
  low: 'border-l-blue-500 bg-blue-50',
};

const priorityLabel: Record<string, string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

function ReasonCard({ reason }: { reason: LossReason }) {
  return (
    <div
      className={`border-l-4 rounded-r-lg p-3 ${priorityStyles[reason.priority] ?? 'border-l-slate-300 bg-slate-50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{reason.pattern}</p>
        <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
          {reason.count}× · Prio: {priorityLabel[reason.priority] ?? reason.priority}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">{reason.recommendation}</p>
    </div>
  );
}

export function AiInsightCard() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [isTriggering, setIsTriggering] = useState(false);

  const { data: insight, isLoading } = useQuery({
    queryKey: insightsKeys.lossInsight(),
    queryFn: () => getLossInsight(session?.accessToken),
    enabled: !!session?.accessToken,
    staleTime: 1000 * 60 * 5,
  });

  const handleTrigger = async () => {
    setIsTriggering(true);
    try {
      await triggerLossAnalysis(session?.accessToken);
      await queryClient.invalidateQueries({ queryKey: insightsKeys.lossInsight() });
    } finally {
      setIsTriggering(false);
    }
  };

  const reasons = insight?.content?.reasons ?? [];
  const hasError = !!insight?.content?.error;

  return (
    <div className="h-full flex flex-col p-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-500" />
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            KI-Verlust-Analyse
          </h3>
        </div>
        <button
          onClick={handleTrigger}
          disabled={isTriggering}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
          aria-label="Neu analysieren"
        >
          <RefreshCw className={`h-3 w-3 ${isTriggering ? 'animate-spin' : ''}`} />
          Neu analysieren
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center animate-pulse">
          <span className="text-slate-300 text-sm">Lade Analyse…</span>
        </div>
      )}

      {!isLoading && !insight && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
          <TrendingDown className="h-8 w-8" />
          <p className="text-sm">Noch keine Analyse vorhanden.</p>
          <button
            onClick={handleTrigger}
            disabled={isTriggering}
            className="text-xs text-indigo-600 underline hover:no-underline disabled:opacity-50"
          >
            Jetzt analysieren
          </button>
        </div>
      )}

      {!isLoading && hasError && (
        <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{insight?.content.error}</span>
        </div>
      )}

      {!isLoading && !hasError && reasons.length > 0 && (
        <>
          <div className="flex-1 flex flex-col gap-2 overflow-auto">
            {reasons.map((r, i) => (
              <ReasonCard key={i} reason={r} />
            ))}
          </div>
          {insight?.createdAt && (
            <p className="mt-2 text-xs text-slate-400">
              Analysiert: {new Date(insight.createdAt).toLocaleDateString('de-DE')}
              {insight.validUntil &&
                ` · Gültig bis: ${new Date(insight.validUntil).toLocaleDateString('de-DE')}`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
