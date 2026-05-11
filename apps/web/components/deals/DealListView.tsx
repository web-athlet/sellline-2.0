'use client';

import Link from 'next/link';
import { formatCurrency, formatDate, scoreColor } from '@/lib/deal-format';
import type { DealCard, Stage } from '@/lib/deals-api';
import { cn } from '@nextgen/utils';

interface Props {
  stages: Stage[];
  deals: DealCard[];
}

export function DealListView({ stages, deals }: Props) {
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  return (
    <div data-testid="deal-list" className="flex flex-col gap-2">
      {deals.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">Keine Deals gefunden.</p>
      ) : (
        deals.map((d) => (
          <Link
            key={d.id}
            href={`/deals/${d.id}`}
            className="flex items-center gap-4 rounded-card border border-slate-200 bg-white p-3 hover:shadow-md"
          >
            <span
              className={cn('h-2 w-2 rounded-full', d.rotIndicator ? 'bg-red-500' : 'bg-slate-300')}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{d.title}</p>
              <p className="text-xs text-slate-500 truncate">{d.org?.name ?? '—'}</p>
            </div>
            <div className="hidden sm:block w-32 shrink-0 text-xs text-slate-600">
              {stageNameById.get(d.stageId) ?? '—'}
            </div>
            <div className="hidden sm:flex w-28 shrink-0 items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn('h-full', scoreColor(d.score))}
                  style={{ width: `${d.score}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 tabular-nums">{d.score}</span>
            </div>
            <div className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">
              {formatCurrency(d.value, d.currency)}
            </div>
            <div className="hidden md:block w-24 shrink-0 text-right text-xs text-slate-500 tabular-nums">
              {formatDate(d.closingDate)}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
