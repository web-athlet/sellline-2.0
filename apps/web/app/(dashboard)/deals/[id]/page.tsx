'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { DealDetailHeader } from '@/components/deals/DealDetailHeader';
import { DealProductsTab } from '@/components/deals/DealProductsTab';
import { SnoozeGhostingModal } from '@/components/deals/SnoozeGhostingModal';
import { useDealsSocket } from '@/hooks/use-deals-socket';
import { formatCurrency, formatDate, scoreColor } from '@/lib/deal-format';
import {
  changeDealStage,
  dealsKeys,
  getDeal,
  listPipelines,
  markDealLost,
  markDealWon,
  snoozeDealGhosting,
  updateDeal,
  type DealDetail,
} from '@/lib/deals-api';
import { cn } from '@nextgen/utils';

type Tab = 'overview' | 'activities' | 'emails' | 'products' | 'participants' | 'files';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'overview', label: 'Übersicht' },
  { value: 'activities', label: 'Aktivitäten' },
  { value: 'emails', label: 'E-Mails' },
  { value: 'products', label: 'Produkte' },
  { value: 'participants', label: 'Teilnehmer' },
  { value: 'files', label: 'Dateien' },
];

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [showSnooze, setShowSnooze] = useState(false);
  const [lostReason, setLostReason] = useState<string | null>(null);

  const dealQuery = useQuery({
    queryKey: dealsKeys.detail(id),
    queryFn: () => getDeal(id, accessToken),
    enabled: Boolean(accessToken && id),
  });

  const pipelinesQuery = useQuery({
    queryKey: dealsKeys.pipelines(),
    queryFn: () => listPipelines(accessToken),
    enabled: Boolean(accessToken),
  });

  useDealsSocket(dealQuery.data?.pipelineId);

  const patchDetail = (next: Partial<DealDetail>) => {
    queryClient.setQueryData<DealDetail | undefined>(dealsKeys.detail(id), (prev) =>
      prev ? { ...prev, ...next } : prev,
    );
  };

  const titleMutation = useMutation({
    mutationFn: (title: string) => updateDeal(id, { title }, accessToken),
    onSuccess: (deal) => patchDetail(deal),
  });

  const stageMutation = useMutation({
    mutationFn: (stageId: string) => changeDealStage(id, { stageId }, accessToken),
    onSuccess: (deal) => patchDetail(deal),
  });

  const wonMutation = useMutation({
    mutationFn: () => markDealWon(id, accessToken),
    onSuccess: (deal) => patchDetail(deal),
  });

  const lostMutation = useMutation({
    mutationFn: (reason: string) => markDealLost(id, reason, accessToken),
    onSuccess: (deal) => patchDetail(deal),
  });

  const snoozeMutation = useMutation({
    mutationFn: (days: number) => snoozeDealGhosting(id, days, accessToken),
    onSuccess: (deal) => patchDetail(deal),
  });

  if (dealQuery.isLoading) {
    return <div className="p-8 text-sm text-slate-400">Lade Deal…</div>;
  }
  if (dealQuery.isError || !dealQuery.data) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-700">Deal nicht gefunden.</p>
        <Link href="/deals" className="text-sm text-indigo-700 hover:underline">
          ← Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const deal = dealQuery.data;
  const pipeline = pipelinesQuery.data?.find((p) => p.id === deal.pipelineId);
  const stages = pipeline?.stages ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 p-6 md:p-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <DealDetailHeader
          deal={deal}
          stages={stages}
          onTitleChange={(t) => titleMutation.mutateAsync(t).then(() => undefined)}
          onStageChange={(s) => stageMutation.mutateAsync(s).then(() => undefined)}
          onMarkWon={() => wonMutation.mutateAsync().then(() => undefined)}
          onMarkLost={() => setLostReason('')}
          onSnooze={() => setShowSnooze(true)}
        />

        <nav role="tablist" className="flex flex-wrap border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px',
                tab === t.value
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="min-h-[300px]">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Pipeline" value={deal.pipeline.name} />
              <Field label="Stage" value={deal.stage.name} />
              <Field label="Owner" value={deal.owner.name} />
              <Field label="Firma" value={deal.org?.name ?? '—'} />
              <Field label="Erstellt" value={formatDate(deal.createdAt)} />
              <Field label="Aktualisiert" value={formatDate(deal.updatedAt)} />
              <Field label="Closing-Datum" value={formatDate(deal.closingDate)} />
              <Field label="Rot-Threshold" value={`${deal.pipeline.rotThresholdDays} Tage`} />
            </div>
          )}
          {tab === 'products' && <DealProductsTab dealId={deal.id} products={deal.products} />}
          {tab === 'participants' && (
            <div className="rounded-card border border-slate-200 bg-white p-4">
              {deal.participants.length === 0 ? (
                <p className="text-sm text-slate-500">Keine Teilnehmer.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {deal.participants.map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <Link href={`/contacts/${p.id}`} className="text-indigo-700 hover:underline">
                        {p.firstName} {p.lastName}
                      </Link>
                      <span className="text-xs text-slate-500">{p.emails?.[0] ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {(tab === 'activities' || tab === 'emails' || tab === 'files') && (
            <div className="rounded-card border border-slate-200 bg-white p-6 text-sm text-slate-500">
              <p>{TABS.find((t) => t.value === tab)?.label} folgen in einer späteren Session.</p>
              {tab === 'activities' && (
                <p className="mt-2 tabular-nums">
                  Aktuell verknüpft: <strong>{deal._count.activities}</strong>
                </p>
              )}
              {tab === 'emails' && (
                <p className="mt-2 tabular-nums">
                  Aktuell verknüpft: <strong>{deal._count.emails}</strong>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4 rounded-card border border-slate-200 bg-white p-4 h-fit sticky top-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wert</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
            {formatCurrency(deal.value, deal.currency)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Wahrscheinlichkeit
          </p>
          <p className="mt-1 text-lg font-medium tabular-nums">{deal.probability}%</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn('h-full transition-all', scoreColor(deal.score))}
                style={{ width: `${deal.score}%` }}
              />
            </div>
            <span className="text-sm tabular-nums">{deal.score}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Closing-Datum
          </p>
          <p className="mt-1 text-sm">{formatDate(deal.closingDate)}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p>
          <p className="mt-1 text-sm">{deal.owner.name}</p>
        </div>

        {deal.ghostingSnoozedUntil && (
          <div className="rounded-button bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ghosting pausiert bis {formatDate(deal.ghostingSnoozedUntil)}
          </div>
        )}
      </aside>

      {showSnooze && (
        <SnoozeGhostingModal
          onClose={() => setShowSnooze(false)}
          onSubmit={(days) => snoozeMutation.mutateAsync(days).then(() => undefined)}
        />
      )}

      {lostReason !== null && (
        <LostDealDialog
          reason={lostReason}
          onChange={setLostReason}
          onClose={() => setLostReason(null)}
          onSubmit={async () => {
            if (!lostReason.trim()) return;
            await lostMutation.mutateAsync(lostReason.trim());
            setLostReason(null);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function LostDealDialog({
  reason,
  onChange,
  onClose,
  onSubmit,
}: {
  reason: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Deal als verloren markieren</h2>
        <p className="mt-2 text-sm text-slate-500">
          Bitte gib einen Grund an — dieser fließt in die Lost-Analytics ein.
        </p>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-button border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="z.B. Wettbewerber günstiger, Budget gestrichen, …"
          maxLength={500}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-button border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => void onSubmit()}
            className="rounded-button bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            Verloren markieren
          </button>
        </div>
      </div>
    </div>
  );
}
