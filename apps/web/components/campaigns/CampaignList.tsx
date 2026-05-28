'use client';

import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { MoreHorizontal, Plus, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CampaignStatusBadge } from './CampaignStatusBadge';
import { CampaignStats } from './CampaignStats';
import type { Campaign } from '@/lib/campaigns-api';

interface CampaignListProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}

export function CampaignList({ campaigns, isLoading, onDelete }: CampaignListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
        <Send className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-4 text-sm font-medium text-slate-900">Noch keine Kampagnen</h3>
        <p className="mt-1 text-sm text-slate-500">Erstellen Sie Ihre erste E-Mail-Kampagne.</p>
        <Link
          href="/campaigns/new"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Neue Kampagne
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <div
          key={campaign.id}
          className="rounded-xl border border-slate-200 bg-white overflow-hidden"
        >
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="truncate text-sm font-semibold text-slate-900 hover:text-indigo-600"
                >
                  {campaign.name}
                </Link>
                <CampaignStatusBadge status={campaign.status} />
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{campaign.subject}</p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
              <span>{campaign.totalRecipients} Empfänger</span>
              <span>
                {formatDistanceToNow(new Date(campaign.createdAt), { locale: de, addSuffix: true })}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setExpanded(expanded === campaign.id ? null : campaign.id)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Stats anzeigen"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {campaign.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => onDelete(campaign.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {expanded === campaign.id && (
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
              <CampaignStats campaign={campaign} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
