'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal';
import { LeadTable } from '@/components/leads/LeadTable';
import { useLeadsSocket } from '@/hooks/use-leads-socket';
import {
  deleteLead,
  leadsKeys,
  listLeads,
  reEnqueueLead,
  type EnrichmentStatus,
  type Lead,
} from '@/lib/leads-api';

const STATUS_TABS: Array<{ label: string; value: EnrichmentStatus | undefined }> = [
  { label: 'Alle', value: undefined },
  { label: 'Ausstehend', value: 'PENDING' },
  { label: 'In Bearbeitung', value: 'PROCESSING' },
  { label: 'Angereichert', value: 'DONE' },
  { label: 'Fehlgeschlagen', value: 'FAILED' },
];

export default function LeadsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [activeStatus, setActiveStatus] = useState<EnrichmentStatus | undefined>(undefined);
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);

  useLeadsSocket();

  const leadsQuery = useQuery({
    queryKey: leadsKeys.list({ enrichmentStatus: activeStatus, limit: 100 }),
    queryFn: () => listLeads({ enrichmentStatus: activeStatus, limit: 100 }, token),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => reEnqueueLead(id, token),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: leadsKeys.all() }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLead(id, token),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: leadsKeys.all() }),
  });

  const leads = leadsQuery.data?.data ?? [];
  const meta = leadsQuery.data?.meta;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead-Posteingang</h1>
          {meta && <p className="mt-0.5 text-sm text-slate-500">{meta.total} Leads gesamt</p>}
        </div>
        <Link
          href="/forms"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Webformulare
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-slate-200 bg-white px-8">
        <div className="flex gap-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveStatus(tab.value)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeStatus === tab.value
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {leadsQuery.isLoading ? (
          <div className="flex h-40 items-center justify-center text-slate-400">Lade Leads...</div>
        ) : leadsQuery.isError ? (
          <div className="flex h-40 items-center justify-center text-red-500">
            Fehler beim Laden der Leads.
          </div>
        ) : (
          <LeadTable
            leads={leads}
            onConvert={setConvertTarget}
            onRetry={(id) => retryMutation.mutate(id)}
            onDelete={(id) => {
              if (confirm('Lead wirklich löschen?')) deleteMutation.mutate(id);
            }}
          />
        )}
      </div>

      <ConvertLeadModal lead={convertTarget} onClose={() => setConvertTarget(null)} />
    </div>
  );
}
