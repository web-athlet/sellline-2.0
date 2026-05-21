'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@nextgen/utils';
import type { Project, ProjectStatus } from '@/lib/projects-api';
import { PROJECT_STATUS_COLOR } from '@/lib/projects-api';
import { ProjectCard } from './ProjectCard';

interface Props {
  status: ProjectStatus;
  label: string;
  projects: Project[];
}

export function ProjectKanbanColumn({ status, label, projects }: Props) {
  const projectIds = projects.map((p) => p.id);
  const { setNodeRef, isOver } = useDroppable({
    id: `status-${status}`,
    data: { status },
  });

  const color = PROJECT_STATUS_COLOR[status];

  return (
    <div
      data-testid="project-kanban-column"
      data-status={status}
      className={cn(
        'flex h-full w-[280px] shrink-0 flex-col rounded-card bg-slate-50 border border-slate-200',
        isOver && 'ring-2 ring-indigo-400',
      )}
    >
      <div
        className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2"
        style={{ boxShadow: `inset 4px 0 0 ${color}` }}
      >
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-800">{label}</h3>
          <p className="text-[11px] text-slate-500 tabular-nums">{projects.length} Projekte</p>
        </div>
      </div>

      <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2">
          <div className="flex flex-col gap-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {projects.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">Keine Projekte</p>
            )}
          </div>
        </div>
      </SortableContext>
    </div>
  );
}
