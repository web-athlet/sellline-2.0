'use client';

import { DashboardBuilder } from '@/components/insights/DashboardBuilder';

export default function InsightsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Insights & Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Widgets verschieben und skalieren — Layout wird automatisch gespeichert.
        </p>
      </div>
      <DashboardBuilder />
    </div>
  );
}
