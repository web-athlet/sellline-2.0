'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { CreateDealModal } from '@/components/deals/CreateDealModal';
import { DealListView } from '@/components/deals/DealListView';
import { DealTableView } from '@/components/deals/DealTableView';
import { DealTimelineView } from '@/components/deals/DealTimelineView';
import { KanbanBoard } from '@/components/deals/KanbanBoard';
import { ViewSwitcher, type DealsView } from '@/components/deals/ViewSwitcher';
import { useDealsSocket } from '@/hooks/use-deals-socket';
import {
  changeDealStage,
  createDeal,
  dealsKeys,
  getPipelineSummary,
  listDeals,
  listPipelines,
  type CreateDealInput,
  type DealCard,
} from '@/lib/deals-api';

export default function DealsPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [view, setView] = useState<DealsView>('kanban');
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const pipelinesQuery = useQuery({
    queryKey: dealsKeys.pipelines(),
    queryFn: () => listPipelines(accessToken),
    enabled: Boolean(accessToken),
  });

  const pipelines = pipelinesQuery.data ?? [];
  const pipelineId =
    activePipelineId ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
  const pipeline = pipelines.find((p) => p.id === pipelineId);

  const dealsQuery = useQuery({
    queryKey: dealsKeys.list({ pipelineId: pipelineId ?? undefined, limit: 500 }),
    queryFn: () => listDeals({ pipelineId: pipelineId ?? undefined, limit: 500 }, accessToken),
    enabled: Boolean(accessToken && pipelineId),
  });

  const summaryQuery = useQuery({
    queryKey: dealsKeys.summary(pipelineId ?? ''),
    queryFn: () => getPipelineSummary(pipelineId!, accessToken),
    enabled: Boolean(accessToken && pipelineId),
  });

  useDealsSocket(pipelineId ?? undefined);

  const stageMutation = useMutation({
    mutationFn: async ({
      dealId,
      toStageId,
      order,
    }: {
      dealId: string;
      fromStageId: string;
      toStageId: string;
      order: number;
    }) => changeDealStage(dealId, { stageId: toStageId, order }, accessToken),
    onSuccess: () => {
      if (pipelineId) {
        void queryClient.invalidateQueries({ queryKey: dealsKeys.summary(pipelineId) });
      }
    },
    onError: (err) => {
      setErrorBanner(err instanceof Error ? err.message : 'Stage-Wechsel fehlgeschlagen');
      setTimeout(() => setErrorBanner(null), 3500);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateDealInput) => createDeal(input, accessToken),
    onSuccess: (deal) => {
      queryClient.setQueriesData<{ data: DealCard[]; meta: unknown } | undefined>(
        { queryKey: dealsKeys.all },
        (prev) => {
          if (!prev?.data) return prev;
          return { ...prev, data: [...prev.data, deal] };
        },
      );
      if (pipelineId) {
        void queryClient.invalidateQueries({ queryKey: dealsKeys.summary(pipelineId) });
      }
    },
  });

  const deals = useMemo(() => dealsQuery.data?.data ?? [], [dealsQuery.data]);
  const stages = pipeline?.stages ?? [];

  const totalValue = useMemo(
    () =>
      summaryQuery.data?.stages.reduce((sum, s) => sum + s.totalValue, 0) ??
      deals.reduce((sum, d) => sum + Number(d.value), 0),
    [summaryQuery.data, deals],
  );

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Deals</h1>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
            {deals.length.toLocaleString('de-DE')} Deals • Pipeline-Wert{' '}
            {new Intl.NumberFormat('de-DE', {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            }).format(totalValue)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pipelines.length > 1 && (
            <select
              value={pipelineId ?? ''}
              onChange={(e) => setActivePipelineId(e.target.value)}
              className="rounded-button border border-slate-200 bg-white px-3 py-1.5 text-sm"
              aria-label="Pipeline"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <ViewSwitcher value={view} onChange={setView} />
          <button
            onClick={() => setShowCreate(true)}
            disabled={!pipelineId}
            className="flex items-center gap-2 rounded-button bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Neuer Deal
          </button>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-button border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorBanner}
        </div>
      )}

      {dealsQuery.isLoading || pipelinesQuery.isLoading ? (
        <div className="py-24 text-center text-sm text-slate-400">Lade Deals…</div>
      ) : !pipeline ? (
        <div className="py-24 text-center text-sm text-slate-400">
          Keine Pipeline gefunden. Lege zuerst eine Pipeline an.
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          stages={stages}
          deals={deals}
          summary={summaryQuery.data}
          onStageChange={async (input) => {
            await stageMutation.mutateAsync(input);
          }}
        />
      ) : view === 'list' ? (
        <DealListView stages={stages} deals={deals} />
      ) : view === 'table' ? (
        <DealTableView stages={stages} deals={deals} />
      ) : (
        <DealTimelineView deals={deals} />
      )}

      {showCreate && pipeline && (
        <CreateDealModal
          pipelineId={pipeline.id}
          stages={pipeline.stages}
          onClose={() => setShowCreate(false)}
          onSubmit={(input) => createMutation.mutateAsync(input).then(() => undefined)}
        />
      )}
    </div>
  );
}
