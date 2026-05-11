'use client';

import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/deal-format';
import type { DealCard, Stage } from '@/lib/deals-api';

interface Props {
  stages: Stage[];
  deals: DealCard[];
}

export function DealTableView({ stages, deals }: Props) {
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  return (
    <div className="overflow-x-auto rounded-card border border-slate-200 bg-white">
      <table data-testid="deal-table" className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">Titel</th>
            <th className="px-3 py-2 text-left">Stage</th>
            <th className="px-3 py-2 text-left">Firma</th>
            <th className="px-3 py-2 text-left">Owner</th>
            <th className="px-3 py-2 text-right">Wert</th>
            <th className="px-3 py-2 text-right">Wahrsch.</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="px-3 py-2 text-left">Closing</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {deals.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link
                  href={`/deals/${d.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {d.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{stageNameById.get(d.stageId) ?? '—'}</td>
              <td className="px-3 py-2 text-slate-600">{d.org?.name ?? '—'}</td>
              <td className="px-3 py-2 text-slate-600">{d.owner.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(d.value, d.currency)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.probability}%</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.score}</td>
              <td className="px-3 py-2 text-slate-600">{formatDate(d.closingDate)}</td>
            </tr>
          ))}
          {deals.length === 0 && (
            <tr>
              <td colSpan={8} className="py-12 text-center text-slate-400">
                Keine Deals gefunden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
