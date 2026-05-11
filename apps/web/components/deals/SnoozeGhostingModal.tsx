'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@nextgen/utils';

const PRESETS = [1, 3, 7, 14, 30] as const;

interface Props {
  onClose: () => void;
  onSubmit: (days: number) => Promise<void>;
}

export function SnoozeGhostingModal({ onClose, onSubmit }: Props) {
  const [days, setDays] = useState<number>(7);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(days);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="snooze-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="snooze-title" className="text-lg font-semibold text-slate-900">
            Ghosting-Alert pausieren
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-button p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Während der Pause wird der Rot-Indikator unterdrückt und der Ghosting-Agent überspringt
          den Deal.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDays(preset)}
              className={cn(
                'rounded-button border px-3 py-1.5 text-sm font-medium',
                days === preset
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {preset} {preset === 1 ? 'Tag' : 'Tage'}
            </button>
          ))}
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-slate-700">Eigene Anzahl Tage:</span>
          <input
            type="number"
            min="1"
            max="365"
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value))))}
            className="w-24 rounded-button border border-slate-200 px-2 py-1 tabular-nums"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-button border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-button bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? 'Speichern…' : `Pausieren (${days})`}
          </button>
        </div>
      </div>
    </div>
  );
}
