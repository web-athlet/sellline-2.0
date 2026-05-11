import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DealCard } from '@/lib/deals-api';
import { DealTimelineView } from './DealTimelineView';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeDeal = (overrides: Partial<DealCard> = {}): DealCard => ({
  id: 'd1',
  title: 'Test Deal',
  value: '1000',
  currency: 'EUR',
  pipelineId: 'p1',
  stageId: 's1',
  ownerId: 'u1',
  orgId: null,
  probability: 50,
  rotIndicator: false,
  ghostingSnoozedUntil: null,
  score: 40,
  order: 0,
  closingDate: '2026-06-01T00:00:00Z',
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

describe('DealTimelineView', () => {
  it('renders empty state', () => {
    render(<DealTimelineView deals={[]} />);
    expect(screen.getByText(/keine deals gefunden/i)).toBeInTheDocument();
  });

  it('buckets deals by week and shows label "Kein Datum" for unscheduled', () => {
    render(<DealTimelineView deals={[makeDeal({ closingDate: null })]} />);
    expect(screen.getByText(/woche ab kein datum/i)).toBeInTheDocument();
  });

  it('renders deal entry inside a week bucket', () => {
    render(<DealTimelineView deals={[makeDeal({ title: 'Q3 Deal' })]} />);
    expect(screen.getByText(/q3 deal/i)).toBeInTheDocument();
  });
});
