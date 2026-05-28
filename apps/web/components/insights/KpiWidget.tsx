'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReportResult } from '@/lib/insights-api';

interface KpiWidgetProps {
  title: string;
  report?: ReportResult;
  summaryKey: string;
  unit?: string;
  description?: string;
}

export function KpiWidget({ title, report, summaryKey, unit = '', description }: KpiWidgetProps) {
  const value = report?.summary[summaryKey];
  const numValue = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  const isPositive = numValue >= 0;

  return (
    <div className="h-full flex flex-col justify-between p-4 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</span>
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
      </div>
      <div className="mt-4">
        <span className="text-4xl font-bold text-slate-900">
          {numValue.toLocaleString('de-DE')}
        </span>
        {unit && <span className="ml-1 text-lg text-slate-500">{unit}</span>}
      </div>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}
