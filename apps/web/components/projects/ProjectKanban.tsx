'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project, ProjectStatus } from '@/lib/projects-api';
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '@/lib/projects-api';
import { ProjectCard } from './ProjectCard';
import { ProjectKanbanColumn } from './ProjectKanbanColumn';

interface Props {
  projects: Project[];
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => Promise<void>;
}

export function ProjectKanban({ projects, onStatusChange }: Props) {
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId) return;
    setLocalProjects(projects);
  }, [projects, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStatus = useMemo(() => {
    const map = new Map<ProjectStatus, Project[]>();
    for (const s of PROJECT_STATUSES) map.set(s, []);
    for (const p of localProjects) {
      map.get(p.status)?.push(p);
    }
    return map;
  }, [localProjects]);

  const findProject = useCallback(
    (id: string) => localProjects.find((p) => p.id === id),
    [localProjects],
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;

      const project = findProject(String(active.id));
      if (!project) return;

      const overId = String(over.id);
      let toStatus: ProjectStatus | null = null;

      if (overId.startsWith('status-')) {
        toStatus = overId.slice('status-'.length) as ProjectStatus;
      } else {
        const overProject = findProject(overId);
        if (overProject) toStatus = overProject.status;
      }

      if (!toStatus || toStatus === project.status) return;

      const snapshot = localProjects;
      setLocalProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, status: toStatus! } : p)),
      );

      try {
        await onStatusChange(project.id, toStatus);
      } catch {
        setLocalProjects(snapshot);
      }
    },
    [findProject, localProjects, onStatusChange],
  );

  const activeProject = activeId ? findProject(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        data-testid="project-kanban"
        className="flex h-[calc(100vh-180px)] gap-3 overflow-x-auto pb-4"
      >
        {PROJECT_STATUSES.map((status) => (
          <ProjectKanbanColumn
            key={status}
            status={status}
            label={PROJECT_STATUS_LABEL[status]}
            projects={byStatus.get(status) ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeProject ? <ProjectCard project={activeProject} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
