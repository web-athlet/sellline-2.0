'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ProjectTaskList } from '@/components/projects/ProjectTaskList';
import {
  createTask,
  deleteTask,
  getProject,
  projectsKeys,
  updateTask,
  type CreateTaskInput,
} from '@/lib/projects-api';

type DetailTab = 'tasks' | 'overview';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<DetailTab>('tasks');

  const projectQuery = useQuery({
    queryKey: projectsKeys.detail(id),
    queryFn: () => getProject(id, token),
    enabled: Boolean(token && id),
  });

  const createTaskMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(id, input, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKeys.detail(id) }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      updateTask(taskId, { done }, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKeys.detail(id) }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKeys.detail(id) }),
  });

  const reorderTaskMutation = useMutation({
    mutationFn: ({ taskId, order }: { taskId: string; order: number }) =>
      updateTask(taskId, { order }, token),
  });

  const project = projectQuery.data;

  if (projectQuery.isLoading) {
    return <div className="py-24 text-center text-sm text-slate-400">Lade Projekt…</div>;
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Projekt nicht gefunden.</p>
        <Link href="/projects" className="mt-4 inline-block text-indigo-600 hover:underline">
          Zurück zu Projekte
        </Link>
      </div>
    );
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'overview', label: 'Übersicht' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <span className="text-4xl leading-none" aria-hidden>
          {project.emoji ?? '📁'}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href="/projects" className="text-sm text-slate-400 hover:text-indigo-600">
              Projekte
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: '#eef2ff',
                color: '#4f46e5',
              }}
            >
              {project.status.replace('_', ' ')}
            </span>
            {project.deal && (
              <Link
                href={`/deals/${project.deal.id}`}
                className="hover:text-indigo-600 hover:underline"
              >
                Deal: {project.deal.title}
              </Link>
            )}
            {project.dueDate && (
              <span>Fällig: {new Date(project.dueDate).toLocaleDateString('de-DE')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Projekt Tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === 'tasks' && (
        <div className="max-w-2xl">
          <ProjectTaskList
            tasks={project.tasks}
            projectId={project.id}
            onCreateTask={(input) => createTaskMutation.mutateAsync(input).then(() => undefined)}
            onToggleTask={(taskId, done) =>
              toggleTaskMutation.mutateAsync({ taskId, done }).then(() => undefined)
            }
            onDeleteTask={(taskId) => deleteTaskMutation.mutateAsync(taskId).then(() => undefined)}
            onReorderTask={(taskId, order) =>
              reorderTaskMutation.mutateAsync({ taskId, order }).then(() => undefined)
            }
          />
        </div>
      )}

      {tab === 'overview' && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Details</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-900">{project.status}</dd>
              <dt className="text-slate-500">Erstellt</dt>
              <dd className="text-slate-900">
                {new Date(project.createdAt).toLocaleDateString('de-DE')}
              </dd>
              {project.template && (
                <>
                  <dt className="text-slate-500">Vorlage</dt>
                  <dd className="text-slate-900">{project.template.name}</dd>
                </>
              )}
              <dt className="text-slate-500">Tasks</dt>
              <dd className="text-slate-900">
                {project.tasks.filter((t) => t.done).length}/{project.tasks.length} erledigt
              </dd>
            </dl>
          </div>

          {(project.tagsJson as string[]).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {(project.tagsJson as string[]).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
