'use client';

import { Search, X } from 'lucide-react';
import { useCallback } from 'react';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  limit: number;
  onLimitChange: (v: number) => void;
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkExport: () => void;
}

export function ContactFilters({
  search,
  onSearchChange,
  limit,
  onLimitChange,
  selectedCount,
  onBulkDelete,
  onBulkExport,
}: Props) {
  const handleClear = useCallback(() => onSearchChange(''), [onSearchChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Name oder E-Mail suchen…"
          aria-label="Kontakte suchen"
          className="w-full rounded-button border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        {search && (
          <button
            onClick={handleClear}
            aria-label="Suche leeren"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Page size */}
      <select
        value={limit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
        aria-label="Einträge pro Seite"
        className="rounded-button border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      >
        <option value={25}>25 / Seite</option>
        <option value={50}>50 / Seite</option>
        <option value={100}>100 / Seite</option>
      </select>

      {/* Bulk actions (shown when something selected) */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-button bg-indigo-50 px-3 py-2 text-sm">
          <span className="font-medium text-indigo-700">{selectedCount} ausgewählt</span>
          <button
            onClick={onBulkExport}
            className="text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            CSV Export
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={onBulkDelete}
            className="text-red-600 hover:text-red-800 hover:underline"
          >
            Löschen
          </button>
        </div>
      )}
    </div>
  );
}
