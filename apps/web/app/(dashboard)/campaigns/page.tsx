'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { CampaignList } from '@/components/campaigns/CampaignList';
import {
  campaignsKeys,
  deleteCampaign,
  listCampaigns,
  type CampaignStatus,
} from '@/lib/campaigns-api';

const STATUS_TABS: Array<{ label: string; value: CampaignStatus | undefined }> = [
  { label: 'Alle', value: undefined },
  { label: 'Entwürfe', value: 'DRAFT' },
  { label: 'Gesendet', value: 'SENT' },
  { label: 'Wird gesendet', value: 'SENDING' },
];

export default function CampaignsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState<CampaignStatus | undefined>(undefined);

  const query = useQuery({
    queryKey: campaignsKeys.list({ status: activeStatus, limit: 100 }),
    queryFn: () => listCampaigns({ status: activeStatus, limit: 100 }, token),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id, token),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() }),
  });

  const campaigns = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">E-Mail-Kampagnen</h1>
          {meta && <p className="mt-0.5 text-sm text-slate-500">{meta.total} Kampagnen gesamt</p>}
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Neue Kampagne
        </Link>
      </div>

      {/* Status tabs */}
      <div className="border-b border-slate-200 bg-white px-8">
        <div className="flex gap-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
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

      {/* List */}
      <div className="flex-1 overflow-y-auto p-8">
        <CampaignList
          campaigns={campaigns}
          isLoading={query.isLoading}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      </div>
    </div>
  );
}
