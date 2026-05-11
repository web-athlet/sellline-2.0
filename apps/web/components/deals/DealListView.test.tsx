import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DealCard } from '@/lib/deals-api';
import { DealListView } from './DealListView';

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
  org: null,
  owner: { id: 'u1', name: 'Max', email: 'max@x.de' },
  participants: [],
  ...overrides,
});

describe('DealListView', () => {
  it('renders an empty state when no deals', () => {
    render(<DealListView stages={[]} deals={[]} />);
    expect(screen.getByText(/keine deals gefunden/i)).toBeInTheDocument();
  });

  it('renders rot indicator for flagged deals', () => {
    const { container } = render(
      <DealListView stages={[]} deals={[makeDeal({ rotIndicator: true })]} />,
    );
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });

  it('renders deal title + currency', () => {
    render(
      <DealListView stages={[]} deals={[makeDeal({ title: 'Großer Deal', value: '5000' })]} />,
    );
    expect(screen.getByText('Großer Deal')).toBeInTheDocument();
    expect(screen.getByText(/5\.000/)).toBeInTheDocument();
  });
});
