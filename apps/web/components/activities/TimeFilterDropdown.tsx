'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { FILTER_LABEL, type ActivityFilter } from '@/lib/activities-api';

const FILTERS: ActivityFilter[] = [
  'todo',
  'overdue',
  'today',
  'tomorrow',
  'this_week',
  'next_week',
  'range',
];

interface Props {
  value: ActivityFilter | undefined;
  onChange: (filter: ActivityFilter | undefined, from?: string, to?: string) => void;
}

export function TimeFilterDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function selectFilter(f: ActivityFilter) {
    if (f === 'range') {
      setShowRange(true);
      setOpen(false);
      return;
    }
    setShowRange(false);
    onChange(f);
    setOpen(false);
  }

  function applyRange() {
    if (from && to) {
      onChange('range', from, to);
      setShowRange(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {value ? FILTER_LABEL[value] : 'Zeitfilter'}
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            Alle
          </button>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 ${
                value === f ? 'font-medium text-blue-600' : 'text-slate-700'
              }`}
              onClick={() => selectFilter(f)}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      )}

      {showRange && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="mb-2 text-xs font-medium text-slate-600">Zeitraum auswählen</p>
          <div className="space-y-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={applyRange}
              disabled={!from || !to}
              className="flex-1 rounded-lg bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Anwenden
            </button>
            <button
              onClick={() => {
                setShowRange(false);
                onChange(undefined);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
