'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { CampaignStats } from '@/components/campaigns/CampaignStats';
import { CampaignStatusBadge } from '@/components/campaigns/CampaignStatusBadge';
import { campaignsKeys, getCampaign, sendCampaign, testSendCampaign } from '@/lib/campaigns-api';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState<string | null>(null);

  const query = useQuery({
    queryKey: campaignsKeys.detail(id),
    queryFn: () => getCampaign(id, token),
    enabled: Boolean(token),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendCampaign(id, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignsKeys.all() });
      setError(null);
    },
    onError: (e: Error) => {
      const body = (e as { body?: { code?: string; message?: string } }).body;
      setError(body?.message ?? e.message);
    },
  });

  const testSendMutation = useMutation({
    mutationFn: () => testSendCampaign(id, token),
    onSuccess: (r) => setTestSent(r.to),
    onError: (e: Error) => setError(e.message),
  });

  const campaign = query.data;

  if (query.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-8 py-5">
        <Link href="/campaigns" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-xl font-semibold text-slate-900">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500">{campaign.subject}</p>
        </div>
        {campaign.status === 'DRAFT' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => testSendMutation.mutate()}
              disabled={testSendMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {testSendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Test senden
            </button>
            <button
              type="button"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Senden
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {testSent && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            Test-E-Mail wurde an {testSent} gesendet.
          </div>
        )}

        <CampaignStats campaign={campaign} />

        {/* Recipients */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Empfänger ({campaign.contacts.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {campaign.contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className="flex-1 text-slate-700">
                  {c.person.firstName} {c.person.lastName}
                  <span className="ml-2 text-slate-400">{c.person.emails[0] ?? ''}</span>
                </span>
                <div className="flex gap-2">
                  {c.openedAt && (
                    <span className="text-xs text-green-600 font-medium">Geöffnet</span>
                  )}
                  {c.clickedAt && (
                    <span className="text-xs text-blue-600 font-medium">Geklickt</span>
                  )}
                  {c.unsubscribedAt && (
                    <span className="text-xs text-orange-600 font-medium">Abgemeldet</span>
                  )}
                  {c.bouncedAt && <span className="text-xs text-red-600 font-medium">Bounced</span>}
                  {!c.person.optIn && <span className="text-xs text-red-400">Kein Opt-in</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HTML Preview */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">E-Mail-Vorschau</h2>
          </div>
          <div className="p-4 bg-slate-50">
            <div
              className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow-sm text-sm"
              dangerouslySetInnerHTML={{ __html: campaign.bodyHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
