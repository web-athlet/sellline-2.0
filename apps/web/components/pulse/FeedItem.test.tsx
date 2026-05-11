import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { FeedItem as FeedItemType } from '@/lib/pulse-api';
import { FeedItem } from './FeedItem';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const makeItem = (overrides: Partial<FeedItemType> = {}): FeedItemType => ({
  id: 'activity:act-1',
  activityId: 'act-1',
  dealId: 'deal-1',
  subject: 'Anruf mit Herr Müller',
  activityType: 'CALL',
  activityDone: false,
  activityDueDate: new Date().toISOString(),
  dealTitle: 'EDV-Angebot Müller GmbH',
  dealValue: 45_000,
  dealCurrency: 'EUR',
  dealStageIndex: 3,
  dealTotalStages: 6,
  dealOwnerId: 'user-1',
  dealOwnerName: 'Mario',
  dealOrgName: 'Müller GmbH',
  activitiesLast7d: 2,
  priorityScore: 55,
  isUrgent: false,
  ...overrides,
});

describe('FeedItem', () => {
  it('renders subject and deal title', () => {
    render(<FeedItem item={makeItem()} onComplete={vi.fn()} />);
    expect(screen.getByText('Anruf mit Herr Müller')).toBeInTheDocument();
    expect(screen.getByText('EDV-Angebot Müller GmbH')).toBeInTheDocument();
  });

  it('shows Dringend badge when isUrgent', () => {
    render(
      <FeedItem item={makeItem({ isUrgent: true, priorityScore: 82 })} onComplete={vi.fn()} />,
    );
    expect(screen.getByText('Dringend')).toBeInTheDocument();
  });

  it('does not show Dringend badge when not urgent', () => {
    render(<FeedItem item={makeItem({ isUrgent: false })} onComplete={vi.fn()} />);
    expect(screen.queryByText('Dringend')).not.toBeInTheDocument();
  });

  it('calls onComplete when checkbox clicked', () => {
    const onComplete = vi.fn();
    render(<FeedItem item={makeItem()} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /aktivität erledigen/i }));
    expect(onComplete).toHaveBeenCalledWith('act-1');
  });

  it('slides out (dismisses) after checkbox click', () => {
    const { container } = render(<FeedItem item={makeItem()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /aktivität erledigen/i }));
    // Component sets dismissed=true and renders null
    expect(container.firstChild).toBeNull();
  });

  it('renders formatted score', () => {
    render(<FeedItem item={makeItem({ priorityScore: 55 })} onComplete={vi.fn()} />);
    expect(screen.getByText('Score 55')).toBeInTheDocument();
  });

  it('shows formatted currency', () => {
    render(<FeedItem item={makeItem({ dealValue: 45_000 })} onComplete={vi.fn()} />);
    expect(screen.getByText(/45/)).toBeInTheDocument();
  });

  it('renders action dropdown on button click', () => {
    render(<FeedItem item={makeItem()} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aktionen' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /deal anzeigen/i })).toBeInTheDocument();
  });

  it('renders without checkbox for deal-only items', () => {
    render(<FeedItem item={makeItem({ activityId: null })} onComplete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /aktivität erledigen/i })).not.toBeInTheDocument();
  });
});
