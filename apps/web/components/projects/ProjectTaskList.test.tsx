import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '@/lib/projects-api';
import { ProjectTaskList } from './ProjectTaskList';

const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  projectId: 'proj-1',
  title: `Task ${id}`,
  description: null,
  dueDate: null,
  done: false,
  doneAt: null,
  assigneeId: null,
  order: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  assignee: null,
  ...overrides,
});

const noop = vi.fn().mockResolvedValue(undefined);

describe('ProjectTaskList', () => {
  it('renders all task titles', () => {
    render(
      <ProjectTaskList
        tasks={[makeTask('t1'), makeTask('t2')]}
        projectId="proj-1"
        onCreateTask={noop}
        onToggleTask={noop}
        onDeleteTask={noop}
        onReorderTask={noop}
      />,
    );
    expect(screen.getByText('Task t1')).toBeInTheDocument();
    expect(screen.getByText('Task t2')).toBeInTheDocument();
  });

  it('shows progress bar with correct count', () => {
    const tasks = [makeTask('t1', { done: true }), makeTask('t2'), makeTask('t3')];
    render(
      <ProjectTaskList
        tasks={tasks}
        projectId="proj-1"
        onCreateTask={noop}
        onToggleTask={noop}
        onDeleteTask={noop}
        onReorderTask={noop}
      />,
    );
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('calls onToggleTask when checkbox clicked', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTaskList
        tasks={[makeTask('t1')]}
        projectId="proj-1"
        onCreateTask={noop}
        onToggleTask={onToggle}
        onDeleteTask={noop}
        onReorderTask={noop}
      />,
    );
    const cb = screen.getByRole('checkbox');
    fireEvent.click(cb);
    expect(onToggle).toHaveBeenCalledWith('t1', true);
  });

  it('calls onDeleteTask when delete button clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTaskList
        tasks={[makeTask('t1')]}
        projectId="proj-1"
        onCreateTask={noop}
        onToggleTask={noop}
        onDeleteTask={onDelete}
        onReorderTask={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /löschen.*Task t1/i }));
    expect(onDelete).toHaveBeenCalledWith('t1');
  });

  it('adds a task via the new task form', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTaskList
        tasks={[]}
        projectId="proj-1"
        onCreateTask={onCreate}
        onToggleTask={noop}
        onDeleteTask={noop}
        onReorderTask={noop}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Neue Aufgabe' }), {
      target: { value: 'Brand new task' },
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Hinzufügen' }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ title: 'Brand new task' });
    });
  });

  it('disables add button when input is empty', () => {
    render(
      <ProjectTaskList
        tasks={[]}
        projectId="proj-1"
        onCreateTask={noop}
        onToggleTask={noop}
        onDeleteTask={noop}
        onReorderTask={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '+ Hinzufügen' })).toBeDisabled();
  });

  it('shows due date when present', () => {
    const tasks = [makeTask('t1', { dueDate: '2026-06-01T00:00:00.000Z' })];
    render(
      <ProjectTaskList
        tasks={tasks}
        projectId="proj-1"
        onCreateTask={noop}
        onToggleTask={noop}
        onDeleteTask={noop}
        onReorderTask={noop}
      />,
    );
    expect(screen.getByText(/Fällig:/)).toBeInTheDocument();
  });

  it('applies line-through style to done tasks', () => {
    const tasks = [makeTask('t1', { done: true })];
    render(
      <ProjectTaskList
        tasks={tasks}
        projectId="proj-1"
        onCreateTask={noop}
        onToggleTask={noop}
        onDeleteTask={noop}
        onReorderTask={noop}
      />,
    );
    const p = screen.getByText('Task t1');
    expect(p).toHaveClass('line-through');
  });
});
