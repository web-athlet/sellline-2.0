import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/projects-api';
import { ProjectKanbanColumn } from './ProjectKanbanColumn';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeProject = (id: string): Project => ({
  id,
  name: `Projekt ${id}`,
  emoji: '🚀',
  dealId: null,
  templateId: null,
  status: 'KICKOFF',
  tagsJson: [],
  doneTasks: 0,
  totalTasks: 3,
  dueDate: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deal: null,
});

const wrap = (ui: React.ReactElement) => <DndContext>{ui}</DndContext>;

describe('ProjectKanbanColumn', () => {
  it('renders column label', () => {
    render(wrap(<ProjectKanbanColumn status="KICKOFF" label="Kick-Off" projects={[]} />));
    expect(screen.getByText('Kick-Off')).toBeInTheDocument();
  });

  it('shows project count', () => {
    const projects = [makeProject('p1'), makeProject('p2')];
    render(wrap(<ProjectKanbanColumn status="KICKOFF" label="Kick-Off" projects={projects} />));
    expect(screen.getByText('2 Projekte')).toBeInTheDocument();
  });

  it('shows empty state when no projects', () => {
    render(wrap(<ProjectKanbanColumn status="KICKOFF" label="Kick-Off" projects={[]} />));
    expect(screen.getByText('Keine Projekte')).toBeInTheDocument();
  });

  it('renders project cards', () => {
    const projects = [makeProject('p1'), makeProject('p2')];
    render(wrap(<ProjectKanbanColumn status="KICKOFF" label="Kick-Off" projects={projects} />));
    expect(screen.getAllByTestId('project-card')).toHaveLength(2);
  });

  it('sets data-status attribute', () => {
    render(wrap(<ProjectKanbanColumn status="PLANNING" label="Planung" projects={[]} />));
    const col = screen.getByTestId('project-kanban-column');
    expect(col).toHaveAttribute('data-status', 'PLANNING');
  });
});
