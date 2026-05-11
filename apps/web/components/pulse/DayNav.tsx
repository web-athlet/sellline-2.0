'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DayNavProps {
  date: string; // YYYY-MM-DD
  onPrev: () => void;
  onNext: () => void;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Heute';
  if (diff === -1) return 'Gestern';
  if (diff === 1) return 'Morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
}

export function DayNav({ date, onPrev, onNext }: DayNavProps) {
  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Vorheriger Tag"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <ChevronLeft size={18} />
      </button>

      <span className="min-w-[140px] text-center text-sm font-medium text-slate-700">
        {formatDisplayDate(date)}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={isToday}
        aria-label="Nächster Tag"
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
