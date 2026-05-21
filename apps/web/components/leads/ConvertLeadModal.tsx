'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { convertLead, leadsKeys, type Lead } from '@/lib/leads-api';
import { dealsKeys, listPipelines, type Pipeline } from '@/lib/deals-api';

interface ConvertLeadModalProps {
  lead: Lead | null;
  onClose: () => void;
}

function getDefaultTitle(lead: Lead): string {
  const d = lead.dataJson;
  const company = lead.companyName ?? (d['company'] as string | undefined) ?? '';
  const name = (d['firstName'] ?? d['name'] ?? '') as string;
  return company ? `Lead: ${company}` : name ? `Lead: ${name}` : 'Neuer Deal';
}

export function ConvertLeadModal({ lead, onClose }: ConvertLeadModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const userId = (session?.user as { id?: string } | null | undefined)?.id ?? '';
  const queryClient = useQueryClient();

  const [dealTitle, setDealTitle] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [stageId, setStageId] = useState('');

  const pipelinesQuery = useQuery({
    queryKey: dealsKeys.pipelines(),
    queryFn: () => listPipelines(token),
    enabled: Boolean(token) && Boolean(lead),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (lead) setDealTitle(getDefaultTitle(lead));
  }, [lead]);

  useEffect(() => {
    const pipelines = pipelinesQuery.data;
    if (pipelines && pipelines.length > 0 && !selectedPipeline) {
      const first = pipelines[0]!;
      setSelectedPipeline(first);
      setStageId(first.stages[0]?.id ?? '');
    }
  }, [pipelinesQuery.data, selectedPipeline]);

  const convertMutation = useMutation({
    mutationFn: () =>
      convertLead(
        lead!.id,
        {
          dealTitle,
          dealValue: dealValue ? parseFloat(dealValue) : undefined,
          pipelineId: selectedPipeline!.id,
          stageId,
          ownerId: userId,
        },
        token,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: leadsKeys.all() });
      onClose();
    },
  });

  if (!lead) return null;

  const canSubmit =
    dealTitle.trim().length > 0 &&
    Boolean(selectedPipeline) &&
    stageId.length > 0 &&
    !convertMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">In Deal konvertieren</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {convertMutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {convertMutation.error instanceof Error
                ? convertMutation.error.message
                : 'Konvertierung fehlgeschlagen'}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Deal-Titel</label>
            <input
              type="text"
              value={dealTitle}
              onChange={(e) => setDealTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Wert (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Pipeline</label>
            <select
              value={selectedPipeline?.id ?? ''}
              onChange={(e) => {
                const p = pipelinesQuery.data?.find((x) => x.id === e.target.value) ?? null;
                setSelectedPipeline(p);
                setStageId(p?.stages[0]?.id ?? '');
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {pipelinesQuery.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Stage</label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {selectedPipeline?.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Lead-Daten (werden als Person übernommen)
            </p>
            <div className="space-y-1 text-sm text-slate-700">
              {Object.entries(lead.dataJson)
                .slice(0, 5)
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-slate-400 w-28 shrink-0 capitalize">{k}:</span>
                    <span className="truncate">{String(v)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Abbrechen
          </button>
          <button
            onClick={() => convertMutation.mutate()}
            disabled={!canSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {convertMutation.isPending ? 'Konvertiere...' : 'In Deal konvertieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
