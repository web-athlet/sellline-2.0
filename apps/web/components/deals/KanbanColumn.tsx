'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { cn } from '@nextgen/utils';
import { formatCurrency } from '@/lib/deal-format';
import type { DealCard as DealCardType, PipelineStageSummary, Stage } from '@/lib/deals-api';
import { DealCard } from './DealCard';

interface Props {
  stage: Stage;
  summary?: PipelineStageSummary;
  deals: DealCardType[];
}

// Beyond this threshold @tanstack/react-virtual takes over so scroll stays
// 60fps. The M3 spec mandates virtualization for columns with > 500 cards.
const VIRTUALIZE_THRESHOLD = 500;

export function KanbanColumn({ stage, summary, deals }: Props) {
  const dealIds = deals.map((d) => d.id);
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: { stageId: stage.id },
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = deals.length > VIRTUALIZE_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: deals.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 104,
    overscan: 8,
    enabled: shouldVirtualize,
  });

  return (
    <div
      data-testid="kanban-column"
      data-stage-id={stage.id}
      className={cn(
        'flex h-full w-[280px] shrink-0 flex-col rounded-card bg-slate-50 border border-slate-200',
        isOver && 'ring-2 ring-indigo-400',
      )}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2"
        style={stage.color ? { boxShadow: `inset 4px 0 0 ${stage.color}` } : undefined}
      >
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-800">{stage.name}</h3>
          <p className="text-[11px] text-slate-500 tabular-nums" data-testid="column-summary">
            {summary?.count ?? deals.length} •{' '}
            {formatCurrency(summary?.totalValue ?? 0, deals[0]?.currency ?? 'EUR')}
          </p>
        </div>
      </div>

      <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
        <div
          ref={(node) => {
            setNodeRef(node);
            scrollRef.current = node;
          }}
          className="flex-1 overflow-y-auto p-2"
        >
          {shouldVirtualize ? (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const deal = deals[vi.index]!;
                return (
                  <div
                    key={deal.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${vi.start}px)`,
                      paddingBottom: 8,
                    }}
                  >
                    <DealCard deal={deal} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
              {deals.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-4">Keine Deals</p>
              )}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
