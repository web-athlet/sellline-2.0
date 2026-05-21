'use client';

import { useState } from 'react';
import type { ProjectTemplate } from '@/lib/projects-api';

interface Props {
  templates: ProjectTemplate[];
  onSubmit: (input: { name: string; emoji?: string; templateId?: string }) => Promise<void>;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['📁', '🚀', '⚙️', '📊', '🎯', '💡', '🔌', '☁️'];

export function CreateProjectModal({ templates, onSubmit, onClose }: Props) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        emoji: emoji || undefined,
        templateId: templateId || undefined,
      });
      onClose();
    } catch {
      setError('Fehler beim Erstellen des Projekts.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="create-project-title" className="text-lg font-semibold text-slate-900">
          Neues Projekt
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="proj-name" className="block text-sm font-medium text-slate-700">
              Name *
            </label>
            <input
              id="proj-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Projektname eingeben"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`Emoji ${e}`}
                  aria-pressed={emoji === e}
                  onClick={() => setEmoji(e)}
                  className={`rounded-lg p-2 text-xl transition-colors ${
                    emoji === e
                      ? 'bg-indigo-100 ring-2 ring-indigo-500'
                      : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label htmlFor="proj-template" className="block text-sm font-medium text-slate-700">
                Vorlage (optional)
              </label>
              <select
                id="proj-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Keine Vorlage</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji ? `${t.emoji} ` : ''}
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Erstellen…' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
