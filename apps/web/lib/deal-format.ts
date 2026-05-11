export function formatCurrency(value: string | number, currency = 'EUR'): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '€0';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function scoreColor(score: number): string {
  if (score >= 67) return 'bg-emerald-500';
  if (score >= 34) return 'bg-amber-500';
  return 'bg-slate-300';
}
