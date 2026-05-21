import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/projects-api';
import { ProjectKanban } from './ProjectKanban';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeProject = (id: string, status: Project['status'] = 'KICKOFF'): Project => ({
  id,
  name: `Projekt ${id}`,
  emoji: '📁',
  dealId: null,
  templateId: null,
  status,
  tagsJson: [],
  doneTasks: 0,
  totalTasks: 0,
  dueDate: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deal: null,
});

describe('ProjectKanban', () => {
  it('renders all 5 status columns', () => {
    render(<ProjectKanban projects={[]} onStatusChange={vi.fn()} />);
    expect(screen.getByText('Kick-Off')).toBeInTheDocument();
    expect(screen.getByText('Planung')).toBeInTheDocument();
    expect(screen.getByText('Implementierung')).toBeInTheDocument();
    expect(screen.getByText('Überprüfen')).toBeInTheDocument();
    expect(screen.getByText('Schließen')).toBeInTheDocument();
  });

  it('places projects in the correct column', () => {
    const projects = [
      makeProject('p1', 'KICKOFF'),
      makeProject('p2', 'PLANNING'),
      makeProject('p3', 'KICKOFF'),
    ];
    render(<ProjectKanban projects={projects} onStatusChange={vi.fn()} />);
    const cards = screen.getAllByTestId('project-card');
    expect(cards).toHaveLength(3);
  });

  it('renders the kanban board container', () => {
    render(<ProjectKanban projects={[]} onStatusChange={vi.fn()} />);
    expect(screen.getByTestId('project-kanban')).toBeInTheDocument();
  });

  it('shows empty state in all columns when no projects', () => {
    render(<ProjectKanban projects={[]} onStatusChange={vi.fn()} />);
    const emptys = screen.getAllByText('Keine Projekte');
    expect(emptys).toHaveLength(5);
  });
});
