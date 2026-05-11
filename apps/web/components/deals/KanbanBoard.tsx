'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DealCard as DealCardType, PipelineSummaryResponse, Stage } from '@/lib/deals-api';
import { DealCard } from './DealCard';
import { KanbanColumn } from './KanbanColumn';

interface Props {
  stages: Stage[];
  deals: DealCardType[];
  summary: PipelineSummaryResponse | undefined;
  onStageChange: (input: {
    dealId: string;
    fromStageId: string;
    toStageId: string;
    order: number;
  }) => Promise<void>;
}

export function KanbanBoard({ stages, deals, summary, onStageChange }: Props) {
  // Local state mirrors the server but lets us apply optimistic patches in
  // < 16ms before the API round-trip. On error we restore the snapshot below.
  const [localDeals, setLocalDeals] = useState<DealCardType[]>(deals);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  // Sync local state when the server-side deals prop changes (initial load,
  // refetch, or WS-driven setQueryData). We skip the sync while a drag is in
  // flight so the optimistic patch isn't overwritten mid-gesture.
  useEffect(() => {
    if (activeDealId) return;
    setLocalDeals(deals);
  }, [deals, activeDealId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealCardType[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const deal of localDeals) {
      const arr = map.get(deal.stageId);
      if (arr) arr.push(deal);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
    return map;
  }, [stages, localDeals]);

  const summaryByStage = useMemo(() => {
    const map = new Map<string, NonNullable<PipelineSummaryResponse>['stages'][number]>();
    if (summary) for (const s of summary.stages) map.set(s.id, s);
    return map;
  }, [summary]);

  const findDeal = useCallback((id: string) => localDeals.find((d) => d.id === id), [localDeals]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDealId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDealId(null);
      const { active, over } = event;
      if (!over) return;

      const activeDeal = findDeal(String(active.id));
      if (!activeDeal) return;

      const overId = String(over.id);
      // Drop target can be either a card (overId = dealId) or a column
      // (overId = 'stage-{stageId}'). Resolve to a target column + insert index.
      let toStageId: string;
      let insertIndex: number;
      const overDeal = findDeal(overId);
      if (overDeal) {
        toStageId = overDeal.stageId;
        const inCol = dealsByStage.get(toStageId) ?? [];
        insertIndex = inCol.findIndex((d) => d.id === overId);
        if (insertIndex === -1) insertIndex = inCol.length;
      } else if (overId.startsWith('stage-')) {
        toStageId = overId.slice('stage-'.length);
        insertIndex = (dealsByStage.get(toStageId) ?? []).length;
      } else {
        return;
      }

      const fromStageId = activeDeal.stageId;
      if (fromStageId === toStageId) {
        const col = dealsByStage.get(toStageId) ?? [];
        const fromIndex = col.findIndex((d) => d.id === activeDeal.id);
        if (fromIndex === insertIndex || fromIndex === -1) return;
      }

      // ── Optimistic patch ──────────────────────────────────────────────
      const snapshot = localDeals;
      const next = localDeals.map((d) => ({ ...d }));
      const target = next.find((d) => d.id === activeDeal.id);
      if (!target) return;
      target.stageId = toStageId;
      target.order = insertIndex;

      // Re-number sibling cards in the destination column so React Query's
      // memo'd selectors see a fresh stable order.
      let i = 0;
      for (const d of next) {
        if (d.stageId === toStageId && d.id !== activeDeal.id) {
          if (i === insertIndex) i++;
          d.order = i++;
        }
      }
      setLocalDeals(next);

      try {
        await onStageChange({
          dealId: activeDeal.id,
          fromStageId,
          toStageId,
          order: insertIndex,
        });
      } catch {
        // Rollback if the API rejects (RBAC, validation, race condition).
        setLocalDeals(snapshot);
      }
    },
    [dealsByStage, findDeal, localDeals, onStageChange],
  );

  const activeDeal = activeDealId ? findDeal(activeDealId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        data-testid="kanban-board"
        className="flex h-[calc(100vh-180px)] gap-3 overflow-x-auto pb-4"
      >
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            summary={summaryByStage.get(stage.id)}
            deals={dealsByStage.get(stage.id) ?? []}
          />
        ))}
      </div>
      <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}</DragOverlay>
    </DndContext>
  );
}
