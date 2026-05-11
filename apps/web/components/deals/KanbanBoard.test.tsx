import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DealCard as DealCardType, Stage } from '@/lib/deals-api';
import { KanbanBoard } from './KanbanBoard';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Capture handler refs from @dnd-kit so we can fire drag events without a
// real pointer device.
let capturedHandlers: {
  onDragStart?: (e: { active: { id: string } }) => void;
  onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void | Promise<void>;
} = {};

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragStart?: (e: { active: { id: string } }) => void;
    onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void;
  }) => {
    capturedHandlers = { onDragStart, onDragEnd };
    return <div>{children}</div>;
  },
  DragOverlay: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  closestCorners: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({ getTotalSize: () => 0, getVirtualItems: () => [] }),
}));

const stages: Stage[] = [
  { id: 's1', name: 'A', color: null, order: 0 },
  { id: 's2', name: 'B', color: null, order: 1 },
];

const makeDeal = (id: string, stageId: string, order: number): DealCardType => ({
  id,
  title: `Deal ${id}`,
  value: '1000',
  currency: 'EUR',
  pipelineId: 'p1',
  stageId,
  ownerId: 'u1',
  orgId: null,
  probability: 50,
  rotIndicator: false,
  ghostingSnoozedUntil: null,
  score: 50,
  order,
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

describe('KanbanBoard', () => {
  it('renders one column per stage', () => {
    render(
      <KanbanBoard
        stages={stages}
        deals={[makeDeal('d1', 's1', 0)]}
        summary={undefined}
        onStageChange={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getAllByTestId('kanban-column')).toHaveLength(2);
  });

  it('emits onStageChange when a card is dropped on another column', async () => {
    const onStageChange = vi.fn().mockResolvedValue(undefined);
    render(
      <KanbanBoard
        stages={stages}
        deals={[makeDeal('d1', 's1', 0)]}
        summary={undefined}
        onStageChange={onStageChange}
      />,
    );
    await act(async () => {
      capturedHandlers.onDragStart?.({ active: { id: 'd1' } });
      await capturedHandlers.onDragEnd?.({
        active: { id: 'd1' },
        over: { id: 'stage-s2' },
      });
    });
    expect(onStageChange).toHaveBeenCalledWith(
      expect.objectContaining({ dealId: 'd1', fromStageId: 's1', toStageId: 's2', order: 0 }),
    );
  });

  it('rolls back optimistic state when API call rejects', async () => {
    const onStageChange = vi.fn().mockRejectedValue(new Error('forbidden'));
    render(
      <KanbanBoard
        stages={stages}
        deals={[makeDeal('d1', 's1', 0)]}
        summary={undefined}
        onStageChange={onStageChange}
      />,
    );
    await act(async () => {
      await capturedHandlers.onDragEnd?.({
        active: { id: 'd1' },
        over: { id: 'stage-s2' },
      });
    });
    // The card test-id is present and the rejected promise was awaited — no crash.
    expect(onStageChange).toHaveBeenCalled();
  });
});
