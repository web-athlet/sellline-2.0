'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { ProjectKanban } from '@/components/projects/ProjectKanban';
import {
  changeProjectStatus,
  createProject,
  getTemplates,
  listProjects,
  projectsKeys,
  type CreateProjectInput,
  type Project,
  type ProjectStatus,
} from '@/lib/projects-api';

export default function ProjectsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: projectsKeys.list({}),
    queryFn: () => listProjects({ limit: 500 }, token),
    enabled: Boolean(token),
  });

  const templatesQuery = useQuery({
    queryKey: projectsKeys.templates(),
    queryFn: () => getTemplates(token),
    enabled: Boolean(token),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) =>
      changeProjectStatus(id, status, token),
    onSuccess: (updated) => {
      queryClient.setQueriesData<{ data: Project[] } | undefined>(
        { queryKey: projectsKeys.lists() },
        (prev) => {
          if (!prev?.data) return prev;
          return { ...prev, data: prev.data.map((p) => (p.id === updated.id ? updated : p)) };
        },
      );
    },
    onError: (err) => {
      setErrorBanner(err instanceof Error ? err.message : 'Status-Wechsel fehlgeschlagen');
      setTimeout(() => setErrorBanner(null), 3500);
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input, token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
    },
  });

  const projects = projectsQuery.data?.data ?? [];
  const templates = templatesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projekte</h1>
          <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
            {projects.length.toLocaleString('de-DE')} Projekte
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-button bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Neues Projekt
        </button>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-button border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorBanner}
        </div>
      )}

      {projectsQuery.isLoading ? (
        <div className="py-24 text-center text-sm text-slate-400">Lade Projekte…</div>
      ) : (
        <ProjectKanban
          projects={projects}
          onStatusChange={async (id, status) => {
            await statusMutation.mutateAsync({ id, status });
          }}
        />
      )}

      {showCreate && (
        <CreateProjectModal
          templates={templates}
          onClose={() => setShowCreate(false)}
          onSubmit={(input) => createMutation.mutateAsync(input).then(() => undefined)}
        />
      )}
    </div>
  );
}
