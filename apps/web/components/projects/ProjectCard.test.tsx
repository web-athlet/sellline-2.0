import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/projects-api';
import { ProjectCard } from './ProjectCard';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  name: 'Test Project',
  emoji: '🚀',
  dealId: null,
  templateId: null,
  status: 'KICKOFF',
  tagsJson: [],
  doneTasks: 2,
  totalTasks: 5,
  dueDate: '2026-06-15T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deal: null,
  ...overrides,
});

const wrap = (ui: React.ReactElement) => (
  <DndContext>
    <SortableContext items={['proj-1']}>{ui}</SortableContext>
  </DndContext>
);

describe('ProjectCard', () => {
  it('renders project name', () => {
    render(wrap(<ProjectCard project={makeProject()} />));
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders emoji', () => {
    render(wrap(<ProjectCard project={makeProject()} />));
    expect(screen.getByText('🚀')).toBeInTheDocument();
  });

  it('shows task progress as x/y Tasks', () => {
    render(wrap(<ProjectCard project={makeProject()} />));
    expect(screen.getByText('2/5 Tasks')).toBeInTheDocument();
  });

  it('renders progress bar with correct width', () => {
    render(wrap(<ProjectCard project={makeProject()} />));
    const bar = screen.getByLabelText('2 von 5 Tasks erledigt').querySelector('div');
    expect(bar?.style.width).toBe('40%');
  });

  it('shows due date when present', () => {
    render(wrap(<ProjectCard project={makeProject()} />));
    expect(screen.getByText(/15\.06\.2026/)).toBeInTheDocument();
  });

  it('hides due date when absent', () => {
    render(wrap(<ProjectCard project={makeProject({ dueDate: null })} />));
    expect(screen.queryByText(/Fällig/)).not.toBeInTheDocument();
  });

  it('renders tags', () => {
    render(wrap(<ProjectCard project={makeProject({ tagsJson: ['urgent', 'crm'] })} />));
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('crm')).toBeInTheDocument();
  });

  it('shows fallback emoji when emoji is null', () => {
    render(wrap(<ProjectCard project={makeProject({ emoji: null })} />));
    expect(screen.getByText('📁')).toBeInTheDocument();
  });

  it('links to project detail page', () => {
    render(wrap(<ProjectCard project={makeProject()} />));
    const link = screen.getByRole('link', { name: 'Test Project' });
    expect(link).toHaveAttribute('href', '/projects/proj-1');
  });

  it('hides tasks section when totalTasks is 0', () => {
    render(wrap(<ProjectCard project={makeProject({ totalTasks: 0, doneTasks: 0 })} />));
    expect(screen.queryByText(/Tasks/)).not.toBeInTheDocument();
  });

  it('applies overlay styling', () => {
    render(wrap(<ProjectCard project={makeProject()} isOverlay />));
    expect(screen.getByTestId('project-card')).toHaveClass('shadow-xl', 'rotate-1');
  });
});
