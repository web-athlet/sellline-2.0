'use client';

import { RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import type { Lead } from '@/lib/leads-api';
import { EnrichmentBadge } from './EnrichmentBadge';

interface LeadTableProps {
  leads: Lead[];
  onConvert: (lead: Lead) => void;
  onRetry: (leadId: string) => void;
  onDelete: (leadId: string) => void;
}

function getDisplayName(data: Record<string, unknown>): string {
  const first = data['firstName'] ?? data['first_name'] ?? data['name'] ?? '';
  const last = data['lastName'] ?? data['last_name'] ?? '';
  const full = `${first} ${last}`.trim();
  return full || (data['email'] as string | undefined) || '—';
}

function getEmail(data: Record<string, unknown>): string {
  return (data['email'] as string | undefined) ?? '—';
}

export function LeadTable({ leads, onConvert, onRetry, onDelete }: LeadTableProps) {
  if (leads.length === 0) {
    return <div className="py-16 text-center text-slate-500">Keine Leads vorhanden.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Kontakt</th>
            <th className="px-4 py-3">E-Mail</th>
            <th className="px-4 py-3">Unternehmen</th>
            <th className="px-4 py-3">Quelle</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Angereicherte Daten</th>
            <th className="px-4 py-3">Erstellt</th>
            <th className="px-4 py-3 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">
                {getDisplayName(lead.dataJson)}
              </td>
              <td className="px-4 py-3 text-slate-600">{getEmail(lead.dataJson)}</td>
              <td className="px-4 py-3 text-slate-600">{lead.companyName ?? '—'}</td>
              <td className="px-4 py-3 text-slate-500">{lead.form?.name ?? lead.source}</td>
              <td className="px-4 py-3">
                <EnrichmentBadge status={lead.enrichmentStatus} />
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-600">
                {lead.enrichmentStatus === 'DONE' && lead.enrichedJson ? (
                  <span className="line-clamp-1 text-xs">
                    {Object.entries(lead.enrichedJson as Record<string, unknown>)
                      .slice(0, 3)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(' · ')}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(lead.createdAt).toLocaleDateString('de-DE')}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  {!lead.convertedDealId && (
                    <button
                      onClick={() => onConvert(lead)}
                      title="In Deal konvertieren"
                      className="rounded p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {lead.enrichmentStatus === 'FAILED' && (
                    <button
                      onClick={() => onRetry(lead.id)}
                      title="Erneut anreichern"
                      className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(lead.id)}
                    title="Löschen"
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
