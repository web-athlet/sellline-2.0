'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { cn } from '@nextgen/utils';
import type { Project } from '@/lib/projects-api';

interface Props {
  project: Project;
  isOverlay?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ProjectCard({ project, isOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    data: { status: project.status },
  });

  const style = { transform: CSS.Translate.toString(transform), transition };

  const tags = Array.isArray(project.tagsJson) ? (project.tagsJson as string[]) : [];
  const total = project.totalTasks;
  const done = project.doneTasks;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid="project-card"
      data-project-id={project.id}
      className={cn(
        'group rounded-card border border-slate-200 bg-white p-3 shadow-sm transition-shadow',
        'cursor-grab active:cursor-grabbing hover:shadow-md',
        isDragging && 'opacity-30',
        isOverlay && 'shadow-xl rotate-1',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none" aria-hidden>
          {project.emoji ?? '📁'}
        </span>
        <Link
          href={`/projects/${project.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-sm font-semibold text-slate-900 hover:text-indigo-700 line-clamp-2"
        >
          {project.name}
        </Link>
      </div>

      {project.dueDate && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
          <span aria-hidden>📅</span> {formatDate(project.dueDate)}
        </p>
      )}

      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="mt-2 space-y-1">
          <div
            className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
            aria-label={`${done} von ${total} Tasks erledigt`}
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 tabular-nums">
            {done}/{total} Tasks
          </p>
        </div>
      )}
    </div>
  );
}
