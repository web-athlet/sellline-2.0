'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import {
  activitiesKeys,
  checkConflicts,
  createActivity,
  TYPE_LABEL,
  type ActivityType,
  type CreateActivityInput,
  type Priority,
} from '@/lib/activities-api';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultDealId?: string;
  defaultPersonId?: string;
  defaultOrgId?: string;
  defaultDate?: string;
}

const TYPES: ActivityType[] = ['CALL', 'MEETING', 'TASK', 'DEADLINE', 'EMAIL', 'LUNCH'];
const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Niedrig',
  NORMAL: 'Normal',
  HIGH: 'Hoch',
  URGENT: 'Dringend',
};

export function CreateActivityModal({
  open,
  onClose,
  defaultDealId,
  defaultPersonId,
  defaultOrgId,
  defaultDate,
}: Props) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [type, setType] = useState<ActivityType>('TASK');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(defaultDate ?? '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [dealId, setDealId] = useState(defaultDealId ?? '');
  const [personId, setPersonId] = useState(defaultPersonId ?? '');
  const [orgId, setOrgId] = useState(defaultOrgId ?? '');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateActivityInput) => createActivity(input, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activitiesKeys.all() });
      onClose();
      resetForm();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Fehler beim Erstellen';
      setError(msg);
    },
  });

  function resetForm() {
    setType('TASK');
    setSubject('');
    setNotes('');
    setDueDate('');
    setStartTime('');
    setEndTime('');
    setPriority('NORMAL');
    setConflictWarning(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConflictWarning(null);

    if (!dealId && !personId && !orgId) {
      setError(
        'Bitte verknüpfen Sie diese Aktivität mit einem Deal, einer Person oder einer Organisation.',
      );
      return;
    }

    // Conflict pre-check for meetings
    if (type === 'MEETING' && startTime && endTime) {
      try {
        const result = await checkConflicts({ startTime, endTime }, token);
        if (result.conflicts.length > 0) {
          const conflictList = result.conflicts.map((c) => `• ${c.subject}`).join('\n');
          setConflictWarning(`Terminkollision mit:\n${conflictList}\n\nTrotzdem erstellen?`);
          return;
        }
      } catch {
        // Non-blocking: proceed if conflict check fails
      }
    }

    submitActivity();
  }

  function submitActivity() {
    mutation.mutate({
      type,
      subject,
      notes: notes || undefined,
      dueDate: dueDate || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      priority,
      dealId: dealId || undefined,
      personId: personId || undefined,
      orgId: orgId || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Neue Aktivität</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Typ</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    type === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Betreff *</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="z.B. Demo-Termin mit Acme GmbH"
              required
            />
          </div>

          {/* Due date / times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Fälligkeit</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            {type === 'MEETING' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Von</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Bis</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Priorität</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          {/* Links — at least one required */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Verknüpfung <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-slate-500">Mindestens Deal, Person oder Organisation</p>
            <div className="space-y-2">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Deal-ID (UUID)"
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Personen-ID (UUID)"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Organisations-ID (UUID)"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notizen</label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionale Notizen..."
            />
          </div>

          {/* Conflict warning */}
          {conflictWarning && (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              <p className="whitespace-pre-line">{conflictWarning}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={submitActivity}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Trotzdem erstellen
                </button>
                <button
                  type="button"
                  onClick={() => setConflictWarning(null)}
                  className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !subject.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Wird erstellt…' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
