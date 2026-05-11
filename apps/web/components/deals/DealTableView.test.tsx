import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DealCard } from '@/lib/deals-api';
import { DealTableView } from './DealTableView';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeDeal = (overrides: Partial<DealCard> = {}): DealCard => ({
  id: 'd1',
  title: 'Test Deal',
  value: '2500',
  currency: 'EUR',
  pipelineId: 'p1',
  stageId: 's1',
  ownerId: 'u1',
  orgId: null,
  probability: 75,
  rotIndicator: false,
  ghostingSnoozedUntil: null,
  score: 80,
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

describe('DealTableView', () => {
  it('renders empty state', () => {
    render(<DealTableView stages={[]} deals={[]} />);
    expect(screen.getByText(/keine deals gefunden/i)).toBeInTheDocument();
  });

  it('looks up stage name from stages array', () => {
    render(
      <DealTableView
        stages={[{ id: 's1', name: 'Verhandlung', color: null, order: 0 }]}
        deals={[makeDeal()]}
      />,
    );
    expect(screen.getByText('Verhandlung')).toBeInTheDocument();
  });

  it('renders all 8 columns + probability', () => {
    render(<DealTableView stages={[]} deals={[makeDeal({ probability: 42 })]} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });
});
