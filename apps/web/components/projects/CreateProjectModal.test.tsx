import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectTemplate } from '@/lib/projects-api';
import { CreateProjectModal } from './CreateProjectModal';

const makeTemplate = (id: string, name: string): ProjectTemplate => ({
  id,
  name,
  emoji: '🚀',
  tasksJson: [],
  createdAt: '2026-01-01T00:00:00Z',
});

describe('CreateProjectModal', () => {
  it('renders name input and submit button', () => {
    render(<CreateProjectModal templates={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erstellen' })).toBeInTheDocument();
  });

  it('disables submit when name is empty', () => {
    render(<CreateProjectModal templates={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Erstellen' });
    expect(btn).toBeDisabled();
  });

  it('enables submit after typing name', () => {
    render(<CreateProjectModal templates={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Mein Projekt' } });
    expect(screen.getByRole('button', { name: 'Erstellen' })).not.toBeDisabled();
  });

  it('calls onSubmit with name and emoji', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateProjectModal templates={[]} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'My Project' } });
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Project' }));
    });
  });

  it('calls onClose on cancel', () => {
    const onClose = vi.fn();
    render(<CreateProjectModal templates={[]} onSubmit={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders template select when templates provided', () => {
    const templates = [makeTemplate('t1', 'Standard'), makeTemplate('t2', 'SaaS')];
    render(<CreateProjectModal templates={templates} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Vorlage (optional)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Standard/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /SaaS/ })).toBeInTheDocument();
  });

  it('hides template select when no templates', () => {
    render(<CreateProjectModal templates={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Vorlage (optional)')).not.toBeInTheDocument();
  });

  it('shows error message on submit failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('fail'));
    render(<CreateProjectModal templates={[]} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'P' } });
    fireEvent.click(screen.getByRole('button', { name: 'Erstellen' }));
    await waitFor(() => {
      expect(screen.getByText('Fehler beim Erstellen des Projekts.')).toBeInTheDocument();
    });
  });

  it('selects emoji on click', () => {
    render(<CreateProjectModal templates={[]} onSubmit={vi.fn()} onClose={vi.fn()} />);
    const rocketBtn = screen.getByRole('button', { name: 'Emoji 🚀' });
    fireEvent.click(rocketBtn);
    expect(rocketBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
