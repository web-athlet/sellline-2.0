import type { CampaignStatus } from '@/lib/campaigns-api';

const CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Entwurf', className: 'bg-slate-100 text-slate-700' },
  SCHEDULED: { label: 'Geplant', className: 'bg-blue-100 text-blue-700' },
  SENDING: { label: 'Wird gesendet', className: 'bg-amber-100 text-amber-700' },
  SENT: { label: 'Gesendet', className: 'bg-green-100 text-green-700' },
  PAUSED: { label: 'Pausiert', className: 'bg-orange-100 text-orange-700' },
  FAILED: { label: 'Fehlgeschlagen', className: 'bg-red-100 text-red-700' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { label, className } = CONFIG[status] ?? CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
