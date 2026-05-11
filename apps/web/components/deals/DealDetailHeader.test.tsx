import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DealDetail } from '@/lib/deals-api';
import { DealDetailHeader } from './DealDetailHeader';

const stages = [
  { id: 's1', name: 'Qualifiziert', color: null, order: 0 },
  { id: 's2', name: 'Demo', color: null, order: 1 },
];

const makeDeal = (overrides: Partial<DealDetail> = {}): DealDetail => ({
  id: 'd1',
  title: 'Mein Deal',
  value: '10000',
  currency: 'EUR',
  pipelineId: 'p1',
  stageId: 's2',
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
  pipeline: { id: 'p1', name: 'Default', rotThresholdDays: 7 },
  stage: { id: 's2', name: 'Demo', color: null, order: 1 },
  products: [],
  _count: { activities: 0, emails: 0 },
  ...overrides,
});

describe('DealDetailHeader', () => {
  it('switches into edit mode and saves new title', async () => {
    const onTitleChange = vi.fn().mockResolvedValue(undefined);
    render(
      <DealDetailHeader
        deal={makeDeal()}
        stages={stages}
        onTitleChange={onTitleChange}
        onStageChange={vi.fn()}
        onMarkWon={vi.fn()}
        onMarkLost={() => {}}
        onSnooze={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Titel bearbeiten' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Neuer Titel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onTitleChange).toHaveBeenCalledWith('Neuer Titel'));
  });

  it('disables won/lost/snooze when already closed', () => {
    render(
      <DealDetailHeader
        deal={makeDeal({ wonAt: '2026-04-01T00:00:00Z' })}
        stages={stages}
        onTitleChange={vi.fn()}
        onStageChange={vi.fn()}
        onMarkWon={vi.fn()}
        onMarkLost={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /gewonnen/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /verloren/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /ghosting pausieren/i })).toBeDisabled();
    expect(screen.getByText(/deal gewonnen am/i)).toBeInTheDocument();
  });

  it('shows lost reason when present', () => {
    render(
      <DealDetailHeader
        deal={makeDeal({ lostAt: '2026-04-01T00:00:00Z', lostReason: 'Wettbewerb' })}
        stages={stages}
        onTitleChange={vi.fn()}
        onStageChange={vi.fn()}
        onMarkWon={vi.fn()}
        onMarkLost={() => {}}
        onSnooze={() => {}}
      />,
    );
    expect(screen.getByText(/wettbewerb/i)).toBeInTheDocument();
  });
});
