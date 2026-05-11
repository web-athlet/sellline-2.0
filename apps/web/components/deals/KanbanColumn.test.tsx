import { DndContext } from '@dnd-kit/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DealCard as DealCardType } from '@/lib/deals-api';
import { KanbanColumn } from './KanbanColumn';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const stage = { id: 's1', name: 'Demo', color: '#3b82f6', order: 0 };

const makeDeal = (id: string): DealCardType => ({
  id,
  title: `Deal ${id}`,
  value: '1000',
  currency: 'EUR',
  pipelineId: 'p1',
  stageId: 's1',
  ownerId: 'u1',
  orgId: null,
  probability: 50,
  rotIndicator: false,
  ghostingSnoozedUntil: null,
  score: 50,
  order: 0,
  closingDate: null,
  closedAt: null,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  org: null,
  owner: { id: 'u1', name: 'Max', email: 'max@x.de' },
  participants: [],
});

describe('KanbanColumn', () => {
  it('shows summary counts when provided', () => {
    render(
      <DndContext>
        <KanbanColumn
          stage={stage}
          summary={{
            id: 's1',
            name: 'Demo',
            color: null,
            order: 0,
            count: 7,
            totalValue: 12500,
            avgProbability: 35,
            weightedValue: 4375,
          }}
          deals={[]}
        />
      </DndContext>,
    );
    const summary = screen.getByTestId('column-summary');
    expect(summary.textContent).toContain('7');
    expect(summary.textContent).toMatch(/12\.500/);
  });

  it('falls back to deal count when summary missing', () => {
    render(
      <DndContext>
        <KanbanColumn stage={stage} deals={[makeDeal('d1'), makeDeal('d2')]} />
      </DndContext>,
    );
    expect(screen.getByTestId('column-summary').textContent).toContain('2');
  });

  it('renders empty hint when no deals and no summary', () => {
    render(
      <DndContext>
        <KanbanColumn stage={stage} deals={[]} />
      </DndContext>,
    );
    expect(screen.getByText(/keine deals/i)).toBeInTheDocument();
  });
});
