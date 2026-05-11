import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DealCard as DealCardType } from '@/lib/deals-api';
import { DealCard } from './DealCard';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeDeal = (overrides: Partial<DealCardType> = {}): DealCardType => ({
  id: 'd1',
  title: 'Test',
  value: '1000',
  currency: 'EUR',
  pipelineId: 'p1',
  stageId: 's1',
  ownerId: 'u1',
  orgId: null,
  probability: 50,
  rotIndicator: false,
  ghostingSnoozedUntil: null,
  score: 60,
  order: 0,
  closingDate: null,
  closedAt: null,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  org: { id: 'o1', name: 'Acme' },
  owner: { id: 'u1', name: 'Max', email: 'max@x.de' },
  participants: [],
  ...overrides,
});

const wrap = (deal: DealCardType) => (
  <DndContext>
    <SortableContext items={[deal.id]}>
      <DealCard deal={deal} />
    </SortableContext>
  </DndContext>
);

describe('DealCard', () => {
  it('renders title + currency formatted', () => {
    render(wrap(makeDeal({ value: '1234.56' })));
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText(/1\.234|1\.235/)).toBeInTheDocument();
  });

  it('shows the rot-indicator when flagged', () => {
    render(wrap(makeDeal({ rotIndicator: true })));
    expect(screen.getByTestId('rot-indicator')).toBeInTheDocument();
  });

  it('does not render the rot indicator when clean', () => {
    render(wrap(makeDeal()));
    expect(screen.queryByTestId('rot-indicator')).not.toBeInTheDocument();
  });

  it('renders org name in the secondary line', () => {
    render(wrap(makeDeal({ org: { id: 'o1', name: 'Apex GmbH' } })));
    expect(screen.getByText('Apex GmbH')).toBeInTheDocument();
  });

  it('exposes probability label', () => {
    render(wrap(makeDeal({ probability: 80 })));
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
