'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { formatCurrency, scoreColor } from '@/lib/deal-format';
import type { DealCard as DealCardType } from '@/lib/deals-api';
import { cn } from '@nextgen/utils';

interface Props {
  deal: DealCardType;
  isOverlay?: boolean;
}

export function DealCard({ deal, isOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { stageId: deal.stageId },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const participant = deal.participants[0];
  const participantName = participant
    ? `${participant.firstName} ${participant.lastName}`.trim()
    : '';
  const orgOrPersonLabel = deal.org?.name ?? participantName ?? '—';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid="deal-card"
      data-deal-id={deal.id}
      className={cn(
        'group relative rounded-card border border-slate-200 bg-white p-3 shadow-sm transition-shadow',
        'cursor-grab active:cursor-grabbing hover:shadow-md',
        isDragging && 'opacity-30',
        isOverlay && 'shadow-xl rotate-1',
      )}
    >
      {deal.rotIndicator && (
        <span
          aria-label="Rot-Indikator: lange keine Aktivität"
          data-testid="rot-indicator"
          className="absolute left-2 top-2 h-2 w-2 rounded-full bg-red-500"
        />
      )}
      <div className="flex items-start justify-between gap-2 pl-4">
        <Link
          href={`/deals/${deal.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-semibold text-slate-900 hover:text-indigo-700 line-clamp-2"
        >
          {deal.title}
        </Link>
      </div>
      <p className="mt-0.5 pl-4 text-xs text-slate-500 truncate">{orgOrPersonLabel || '—'}</p>

      <div className="mt-2 pl-4 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full transition-all', scoreColor(deal.score))}
          style={{ width: `${Math.min(100, Math.max(0, deal.score))}%` }}
          aria-label={`Score: ${deal.score}`}
        />
      </div>

      <div className="mt-2 pl-4 flex items-center justify-between text-xs text-slate-700">
        <span className="font-medium">{formatCurrency(deal.value, deal.currency)}</span>
        <span className="text-slate-500">{deal.probability}%</span>
      </div>
    </div>
  );
}
