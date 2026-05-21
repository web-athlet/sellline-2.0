'use client';

import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { type ImportResult } from '@/lib/products-api';

interface ImportCsvModalProps {
  onClose: () => void;
  onImport: (file: File) => Promise<ImportResult>;
}

const CSV_COLUMNS = [
  'name (Pflicht)',
  'code',
  'category',
  'unit',
  'billingFreq',
  'price (Pflicht)',
  'taxPct',
  'currency',
  'visibleFor',
];

export function ImportCsvModal({ onClose, onImport }: ImportCsvModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const [header, ...dataLines] = lines;
      if (!header) return;
      const headers = header.split(',').map((h) => h.trim());
      const rows = dataLines.slice(0, 10).map((line) => line.split(',').map((c) => c.trim()));
      setPreviewHeaders(headers);
      setPreviewRows(rows);
    };
    reader.readAsText(selected);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsPending(true);
    setImportError(null);
    try {
      const res = await onImport(file);
      setResult(res);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import fehlgeschlagen');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Produkte per CSV importieren</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">Erwartete CSV-Spalten:</p>
            <p className="mt-1 font-mono text-xs">{CSV_COLUMNS.join(', ')}</p>
            <p className="mt-2 text-xs text-slate-500">
              Max. 5000 Zeilen. Zeilen mit Fehlern werden übersprungen und im Bericht aufgeführt.
              <br />
              <code className="rounded bg-slate-200 px-1">visibleFor</code>: Komma-separierte
              Rollen, z.B. <code className="rounded bg-slate-200 px-1">ADMIN,MANAGER</code>
            </p>
          </div>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
              data-testid="csv-file-input"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
            >
              <Upload className="h-5 w-5" />
              {file ? file.name : 'CSV-Datei auswählen'}
            </button>
          </div>

          {previewHeaders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">
                Vorschau (erste 10 Zeilen)
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {previewHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 text-slate-700">
                            {cell || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{importError}</p>
          )}

          {result && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${result.errors.length === 0 ? 'bg-green-50' : 'bg-amber-50'}`}
            >
              <p className="font-semibold text-slate-800">
                {result.created} Produkt{result.created !== 1 ? 'e' : ''} importiert
                {result.errors.length > 0 && `, ${result.errors.length} Fehler`}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {result.errors.slice(0, 10).map((err) => (
                    <li key={err.row}>
                      Zeile {err.row}: {err.msg}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-slate-500">… und {result.errors.length - 10} weitere</li>
                  )}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {result ? 'Schließen' : 'Abbrechen'}
            </button>
            {!result && (
              <button
                type="button"
                disabled={!file || isPending}
                onClick={() => void handleImport()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {isPending ? 'Importiere…' : 'Importieren'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
