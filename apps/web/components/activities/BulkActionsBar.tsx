'use client';

import { CheckCircle, Trash2, UserCheck, X } from 'lucide-react';

interface Props {
  selected: string[];
  onClear: () => void;
  onMarkDone: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
}

export function BulkActionsBar({ selected, onClear, onMarkDone, onDelete }: Props) {
  if (selected.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm">
      <span className="font-medium text-blue-700">{selected.length} ausgewählt</span>
      <div className="flex gap-2">
        <button
          onClick={() => onMarkDone(selected)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Erledigt
        </button>
        <button
          onClick={() => onDelete(selected)}
          className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Löschen
        </button>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          title="Zuweisen — folgt in einem späteren Release"
        >
          <UserCheck className="h-3.5 w-3.5" />
          Zuweisen
        </button>
      </div>
      <button onClick={onClear} className="ml-auto text-slate-500 hover:text-slate-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
