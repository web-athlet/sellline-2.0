'use client';

import { Calendar, Columns3, List, Table } from 'lucide-react';
import { cn } from '@nextgen/utils';

export type DealsView = 'kanban' | 'list' | 'table' | 'timeline';

interface Props {
  value: DealsView;
  onChange: (v: DealsView) => void;
}

const TABS: Array<{ value: DealsView; label: string; Icon: typeof Columns3 }> = [
  { value: 'kanban', label: 'Kanban', Icon: Columns3 },
  { value: 'list', label: 'Liste', Icon: List },
  { value: 'table', label: 'Tabelle', Icon: Table },
  { value: 'timeline', label: 'Zeitachse', Icon: Calendar },
];

export function ViewSwitcher({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      data-testid="view-switcher"
      className="inline-flex rounded-button border border-slate-200 bg-white p-0.5"
    >
      {TABS.map((tab) => {
        const Icon = tab.Icon;
        const isActive = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            data-active={isActive}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-medium transition-colors',
              isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
