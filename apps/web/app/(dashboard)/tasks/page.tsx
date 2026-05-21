'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { deleteTask, listTasks, tasksKeys, updateTask, type TasksQuery } from '@/lib/projects-api';

type TaskFilter = 'mine' | 'all' | 'today' | 'week';

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isThisWeek(d: Date) {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  return d >= now && d <= weekEnd;
}

export default function TasksPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const userId = (session as { user?: { id?: string } } | null)?.user?.id;
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<TaskFilter>('mine');
  const [showDone, setShowDone] = useState(false);

  const query: TasksQuery = {
    ...(filter === 'mine' && userId ? { assigneeId: userId } : {}),
    ...(showDone ? {} : { done: false }),
    limit: 200,
  };

  const tasksQuery = useQuery({
    queryKey: tasksKeys.list(query),
    queryFn: () => listTasks(query, token),
    enabled: Boolean(token),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      updateTask(taskId, { done }, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKeys.lists() }),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKeys.lists() }),
  });

  const allTasks = tasksQuery.data?.data ?? [];

  const filteredTasks = allTasks.filter((task) => {
    if (filter === 'today') {
      return task.dueDate && isSameDay(new Date(task.dueDate), new Date());
    }
    if (filter === 'week') {
      return task.dueDate && isThisWeek(new Date(task.dueDate));
    }
    return true;
  });

  const FILTERS: { id: TaskFilter; label: string }[] = [
    { id: 'mine', label: 'Meine' },
    { id: 'all', label: 'Alle' },
    { id: 'today', label: 'Heute fällig' },
    { id: 'week', label: 'Diese Woche' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Aufgaben</h1>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
            {filteredTasks.length} Aufgabe{filteredTasks.length !== 1 ? 'n' : ''}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Erledigte anzeigen
        </label>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tasksQuery.isLoading ? (
        <div className="py-24 text-center text-sm text-slate-400">Lade Aufgaben…</div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-24 text-center text-sm text-slate-400">Keine Aufgaben gefunden.</div>
      ) : (
        <div className="max-w-3xl space-y-2">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              data-testid="task-row"
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={(e) => toggleMutation.mutate({ taskId: task.id, done: e.target.checked })}
                aria-label={`${task.done ? 'Erledigt' : 'Ausstehend'}: ${task.title}`}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${task.done ? 'line-through text-slate-400' : 'text-slate-900'}`}
                >
                  {task.title}
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                  {task.project && (
                    <Link href={`/projects/${task.project.id}`} className="hover:text-indigo-600">
                      {task.project.emoji ?? '📁'} {task.project.name}
                    </Link>
                  )}
                  {task.dueDate && (
                    <span
                      className={
                        !task.done && new Date(task.dueDate) < new Date()
                          ? 'text-red-500 font-medium'
                          : ''
                      }
                    >
                      📅 {new Date(task.dueDate).toLocaleDateString('de-DE')}
                    </span>
                  )}
                  {task.assignee && <span>{task.assignee.name}</span>}
                </div>
              </div>

              <button
                onClick={() => deleteMutation.mutate(task.id)}
                aria-label={`Aufgabe löschen: ${task.title}`}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
