'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Circle, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  activitiesKeys,
  deleteActivity,
  formatDueDate,
  markActivityDone,
  PRIORITY_LABEL,
  TYPE_LABEL,
  type Activity,
  type Priority,
} from '@/lib/activities-api';
import { ActivityTypeIcon } from './ActivityTypeIcon';
import { BulkActionsBar } from './BulkActionsBar';

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-50 text-amber-700',
  URGENT: 'bg-red-50 text-red-700',
};

interface Props {
  activities: Activity[];
  token?: string;
}

export function ActivityList({ activities, token }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const doneMutation = useMutation({
    mutationFn: (id: string) => markActivityDone(id, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activitiesKeys.all() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteActivity(id, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activitiesKeys.all() });
      setSelected((s) => s.filter((x) => x !== 'deleted'));
    },
  });

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function toggleAll() {
    setSelected((s) => (s.length === activities.length ? [] : activities.map((a) => a.id)));
  }

  function handleBulkDone(ids: string[]) {
    ids.forEach((id) => doneMutation.mutate(id));
    setSelected([]);
  }

  function handleBulkDelete(ids: string[]) {
    if (!confirm(`${ids.length} Aktivitäten löschen?`)) return;
    ids.forEach((id) => deleteMutation.mutate(id));
    setSelected([]);
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <CheckCircle className="mb-4 h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">Keine Aktivitäten</p>
        <p className="mt-1 text-sm">Erstellen Sie Ihre erste Aktivität über den Button oben.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <BulkActionsBar
        selected={selected}
        onClear={() => setSelected([])}
        onMarkDone={handleBulkDone}
        onDelete={handleBulkDelete}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.length === activities.length && activities.length > 0}
                  onChange={toggleAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Typ
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Betreff
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Deal
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Person
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Organisation
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fälligkeit
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Dauer
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Zugewiesen
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Priorität
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="w-10 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activities.map((a) => (
              <tr
                key={a.id}
                className={`transition-colors hover:bg-slate-50 ${a.done ? 'opacity-60' : ''} ${selected.includes(a.id) ? 'bg-blue-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    className="rounded border-slate-300"
                  />
                </td>
                {/* Typ */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <ActivityTypeIcon type={a.type} />
                    <span className="hidden text-xs text-slate-500 xl:block">
                      {TYPE_LABEL[a.type]}
                    </span>
                  </div>
                </td>
                {/* Betreff */}
                <td className="max-w-[200px] px-3 py-3">
                  <p
                    className={`truncate font-medium ${a.done ? 'line-through text-slate-400' : 'text-slate-900'}`}
                  >
                    {a.subject}
                  </p>
                  {a.notes && <p className="mt-0.5 truncate text-xs text-slate-400">{a.notes}</p>}
                </td>
                {/* Deal */}
                <td className="px-3 py-3">
                  {a.deal ? (
                    <Link
                      href={`/deals/${a.deal.id}`}
                      className="truncate text-blue-600 hover:underline text-xs"
                    >
                      {a.deal.title}
                    </Link>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {/* Person */}
                <td className="px-3 py-3">
                  {a.person ? (
                    <Link
                      href={`/contacts/${a.person.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {a.person.firstName} {a.person.lastName}
                    </Link>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {/* Org */}
                <td className="px-3 py-3 text-xs text-slate-600">
                  {a.org?.name ?? <span className="text-slate-300">—</span>}
                </td>
                {/* Fälligkeit */}
                <td className="px-3 py-3">
                  <span
                    className={`text-xs font-medium ${!a.done && a.dueDate && new Date(a.dueDate) < new Date() ? 'text-red-600' : 'text-slate-700'}`}
                  >
                    {formatDueDate(a.dueDate)}
                  </span>
                </td>
                {/* Dauer */}
                <td className="px-3 py-3 text-xs text-slate-600">
                  {a.startTime && a.endTime ? (
                    `${Math.round((new Date(a.endTime).getTime() - new Date(a.startTime).getTime()) / 60_000)} Min.`
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {/* Zugewiesen */}
                <td className="px-3 py-3 text-xs text-slate-600">{a.assignee.name}</td>
                {/* Priorität */}
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[a.priority]}`}
                  >
                    {PRIORITY_LABEL[a.priority]}
                  </span>
                </td>
                {/* Status */}
                <td className="px-3 py-3">
                  {a.done ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle className="h-3 w-3" /> Erledigt
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      <Circle className="h-3 w-3" /> Offen
                    </span>
                  )}
                </td>
                {/* Actions */}
                <td className="px-3 py-3">
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                      className="rounded p-1 hover:bg-slate-100"
                    >
                      <MoreHorizontal className="h-4 w-4 text-slate-500" />
                    </button>
                    {openMenu === a.id && (
                      <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 bg-white shadow-lg">
                        {!a.done && (
                          <button
                            onClick={() => {
                              doneMutation.mutate(a.id);
                              setOpenMenu(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <CheckCircle className="h-4 w-4 text-emerald-500" /> Erledigt
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('Aktivität löschen?')) deleteMutation.mutate(a.id);
                            setOpenMenu(null);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" /> Löschen
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
