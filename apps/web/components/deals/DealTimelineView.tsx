'use client';

import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/deal-format';
import type { DealCard } from '@/lib/deals-api';
import { cn } from '@nextgen/utils';

interface Props {
  deals: DealCard[];
}

// Buckets deals by their closingDate (week-of). Past weeks are coloured red,
// the current week amber, future weeks indigo.
function bucketKey(date: string | null): string {
  if (!date) return 'Kein Datum';
  const d = new Date(date);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function DealTimelineView({ deals }: Props) {
  const buckets = new Map<string, DealCard[]>();
  for (const d of deals) {
    const key = bucketKey(d.closingDate);
    const arr = buckets.get(key) ?? [];
    arr.push(d);
    buckets.set(key, arr);
  }
  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => {
    if (a === 'Kein Datum') return 1;
    if (b === 'Kein Datum') return -1;
    return (
      new Date(a.split('.').reverse().join('-')).getTime() -
      new Date(b.split('.').reverse().join('-')).getTime()
    );
  });

  const today = new Date();
  return (
    <div data-testid="deal-timeline" className="flex flex-col gap-4">
      {sorted.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">Keine Deals gefunden.</p>
      ) : (
        sorted.map(([label, items]) => {
          const tone =
            label === 'Kein Datum'
              ? 'border-slate-200 bg-slate-50'
              : new Date(label.split('.').reverse().join('-')) < today
                ? 'border-red-200 bg-red-50'
                : 'border-indigo-200 bg-indigo-50';
          return (
            <section key={label} className={cn('rounded-card border p-3', tone)}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Woche ab {label}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/deals/${d.id}`}
                      className="flex-1 truncate text-slate-800 hover:text-indigo-700"
                    >
                      {d.title} — {d.org?.name ?? '—'}
                    </Link>
                    <span className="tabular-nums text-slate-700 font-medium">
                      {formatCurrency(d.value, d.currency)}
                    </span>
                    <span className="text-xs text-slate-500 w-24 text-right">
                      {formatDate(d.closingDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
