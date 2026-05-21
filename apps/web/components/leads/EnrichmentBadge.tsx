import { Loader2 } from 'lucide-react';
import type { EnrichmentStatus } from '@/lib/leads-api';
import { ENRICHMENT_LABEL } from '@/lib/leads-api';

interface EnrichmentBadgeProps {
  status: EnrichmentStatus;
}

const CONFIG: Record<EnrichmentStatus, { className: string; showSpinner: boolean }> = {
  PENDING: { className: 'bg-slate-100 text-slate-600', showSpinner: false },
  PROCESSING: { className: 'bg-blue-100 text-blue-700', showSpinner: true },
  DONE: { className: 'bg-green-100 text-green-700', showSpinner: false },
  FAILED: { className: 'bg-red-100 text-red-700', showSpinner: false },
};

export function EnrichmentBadge({ status }: EnrichmentBadgeProps) {
  const { className, showSpinner } = CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {showSpinner && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {ENRICHMENT_LABEL[status]}
    </span>
  );
}
