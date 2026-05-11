'use client';

import { cn } from '@nextgen/utils';
import type { PulseTab } from '@/lib/pulse-api';

interface TabBarProps {
  activeTab: PulseTab;
  counts: { followups: number; missed: number; opportunities: number };
  onTabChange: (tab: PulseTab) => void;
}

const TABS: { id: PulseTab; label: string }[] = [
  { id: 'followups', label: 'Follow-Ups' },
  { id: 'missed', label: 'Übersehene Deals' },
  { id: 'opportunities', label: 'Verkaufschancen' },
];

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 leading-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function TabBar({ activeTab, counts, onTabChange }: TabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Pulse-Feed Tabs"
      className="flex gap-1 border-b border-slate-200"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              isActive
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            )}
          >
            {tab.label}
            <Badge count={counts[tab.id]} />
          </button>
        );
      })}
    </div>
  );
}
