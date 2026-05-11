'use client';

import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import type { DealDetail, Stage } from '@/lib/deals-api';
import { StageStepper } from './StageStepper';

interface Props {
  deal: DealDetail;
  stages: Stage[];
  onTitleChange: (title: string) => Promise<void>;
  onStageChange: (stageId: string) => Promise<void>;
  onMarkWon: () => Promise<void>;
  onMarkLost: () => void;
  onSnooze: () => void;
}

export function DealDetailHeader({
  deal,
  stages,
  onTitleChange,
  onStageChange,
  onMarkWon,
  onMarkLost,
  onSnooze,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(deal.title);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || title === deal.title) {
      setEditing(false);
      setTitle(deal.title);
      return;
    }
    setSaving(true);
    try {
      await onTitleChange(title.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const isClosed = deal.wonAt !== null || deal.lostAt !== null;

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-button border border-indigo-300 px-3 py-1.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              aria-label="Speichern"
              className="rounded-button bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setTitle(deal.title);
              }}
              aria-label="Abbrechen"
              className="rounded-button border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{deal.title}</h1>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Titel bearbeiten"
              className="rounded-button p-1 text-slate-400 hover:bg-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSnooze}
            disabled={isClosed}
            className="rounded-button border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Ghosting pausieren
          </button>
          <button
            type="button"
            onClick={() => void onMarkWon()}
            disabled={isClosed}
            className="rounded-button bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Gewonnen
          </button>
          <button
            type="button"
            onClick={onMarkLost}
            disabled={isClosed}
            className="rounded-button border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Verloren
          </button>
        </div>
      </div>

      <StageStepper
        stages={stages}
        currentStageId={deal.stageId}
        onChange={(s) => void onStageChange(s)}
        disabled={isClosed}
      />

      {deal.wonAt && (
        <p className="text-sm font-medium text-emerald-700">
          ✓ Deal gewonnen am {new Date(deal.wonAt).toLocaleDateString('de-DE')}
        </p>
      )}
      {deal.lostAt && (
        <p className="text-sm font-medium text-red-700">
          ✗ Deal verloren am {new Date(deal.lostAt).toLocaleDateString('de-DE')}
          {deal.lostReason ? ` — ${deal.lostReason}` : ''}
        </p>
      )}
    </div>
  );
}
