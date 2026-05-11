'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type {
  DealCreatedEvent,
  DealDeletedEvent,
  DealRotIndicatorEvent,
  DealStageChangedEvent,
  DealUpdatedEvent,
} from '@nextgen/types';
import {
  dealsKeys,
  getDeal,
  getPipelineSummary,
  type DealCard,
  type DealDetail,
} from '@/lib/deals-api';
import { getSocket } from '@/lib/socket';

/**
 * Subscribes to deal:* WebSocket events and applies them to the React-Query
 * cache via `setQueryData` (M3 spec § Performance — no global invalidations).
 *
 * The pipeline-summary cache cannot be patched in place (totals are server-side
 * aggregates), so we invalidate just that one query when stage/value changes.
 */
export function useDealsSocket(pipelineId: string | undefined): void {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (!pipelineId || !accessToken) return;
    const socket = getSocket(accessToken);

    const patchListCard = (next: DealCard) => {
      queryClient.setQueriesData<{ data: DealCard[]; meta: unknown }>(
        { queryKey: dealsKeys.all },
        (prev) => {
          if (!prev?.data) return prev;
          const idx = prev.data.findIndex((d) => d.id === next.id);
          if (idx === -1) return { ...prev, data: [...prev.data, next] };
          const data = prev.data.slice();
          data[idx] = { ...data[idx]!, ...next };
          return { ...prev, data };
        },
      );
      queryClient.setQueryData<DealDetail | undefined>(dealsKeys.detail(next.id), (prev) =>
        prev ? { ...prev, ...next } : prev,
      );
    };

    const handleUpdated = async (evt: DealUpdatedEvent) => {
      if (evt.pipelineId !== pipelineId) return;
      try {
        const fresh = await getDeal(evt.dealId, accessToken);
        patchListCard(fresh);
      } catch {
        // Detail fetch failed — fall back to an invalidation so React Query
        // refetches on next consumer mount.
        await queryClient.invalidateQueries({ queryKey: dealsKeys.detail(evt.dealId) });
      }
    };

    const handleStageChanged = (evt: DealStageChangedEvent) => {
      if (evt.pipelineId !== pipelineId) return;
      queryClient.setQueriesData<{ data: DealCard[] }>({ queryKey: dealsKeys.all }, (prev) => {
        if (!prev?.data) return prev;
        const data = prev.data.map((d) =>
          d.id === evt.dealId ? { ...d, stageId: evt.newStageId, order: evt.order } : d,
        );
        return { ...prev, data };
      });
      // Aggregates must come from the server — let RQ refetch the summary.
      void queryClient.invalidateQueries({ queryKey: dealsKeys.summary(pipelineId) });
    };

    const handleCreated = async (evt: DealCreatedEvent) => {
      if (evt.pipelineId !== pipelineId) return;
      try {
        const fresh = await getDeal(evt.dealId, accessToken);
        patchListCard(fresh);
      } catch {
        // ignore — list will hydrate on next refetch
      }
      void queryClient.invalidateQueries({ queryKey: dealsKeys.summary(pipelineId) });
    };

    const handleDeleted = (evt: DealDeletedEvent) => {
      if (evt.pipelineId !== pipelineId) return;
      queryClient.setQueriesData<{ data: DealCard[] }>({ queryKey: dealsKeys.all }, (prev) => {
        if (!prev?.data) return prev;
        return { ...prev, data: prev.data.filter((d) => d.id !== evt.dealId) };
      });
      queryClient.removeQueries({ queryKey: dealsKeys.detail(evt.dealId) });
      void queryClient.invalidateQueries({ queryKey: dealsKeys.summary(pipelineId) });
    };

    const handleRot = (evt: DealRotIndicatorEvent) => {
      if (evt.pipelineId !== pipelineId) return;
      queryClient.setQueriesData<{ data: DealCard[] }>({ queryKey: dealsKeys.all }, (prev) => {
        if (!prev?.data) return prev;
        const data = prev.data.map((d) =>
          d.id === evt.dealId ? { ...d, rotIndicator: evt.rotIndicator } : d,
        );
        return { ...prev, data };
      });
    };

    socket.on('deal:created', handleCreated);
    socket.on('deal:updated', handleUpdated);
    socket.on('deal:stage_changed', handleStageChanged);
    socket.on('deal:deleted', handleDeleted);
    socket.on('deal:rot_indicator', handleRot);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off('deal:created', handleCreated);
      socket.off('deal:updated', handleUpdated);
      socket.off('deal:stage_changed', handleStageChanged);
      socket.off('deal:deleted', handleDeleted);
      socket.off('deal:rot_indicator', handleRot);
    };
  }, [accessToken, pipelineId, queryClient]);
}

// Re-export for tests
export { getPipelineSummary };
