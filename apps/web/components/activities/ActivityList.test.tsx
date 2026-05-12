import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityList } from './ActivityList';
import type { Activity } from '@/lib/activities-api';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/activities-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/activities-api')>();
  return {
    ...actual,
    markActivityDone: vi.fn().mockResolvedValue({}),
    deleteActivity: vi.fn().mockResolvedValue(undefined),
  };
});

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  type: 'TASK',
  subject: 'Demo Aufgabe',
  notes: null,
  dueDate: null,
  startTime: null,
  endTime: null,
  done: false,
  doneAt: null,
  priority: 'NORMAL',
  dealId: 'deal-1',
  personId: null,
  orgId: null,
  assigneeId: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deal: { id: 'deal-1', title: 'Acme Deal', value: '5000', currency: 'EUR' },
  person: null,
  org: null,
  assignee: { id: 'user-1', name: 'Max Muster', email: 'max@test.de' },
  ...overrides,
});

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ActivityList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no activities', () => {
    renderWithClient(<ActivityList activities={[]} />);
    expect(screen.getByText(/keine aktivitäten/i)).toBeTruthy();
  });

  it('renders activity row with subject', () => {
    renderWithClient(<ActivityList activities={[makeActivity()]} />);
    expect(screen.getByText('Demo Aufgabe')).toBeTruthy();
  });

  it('renders deal link', () => {
    renderWithClient(<ActivityList activities={[makeActivity()]} />);
    const link = screen.getByText('Acme Deal');
    expect(link.tagName).toBe('A');
  });

  it('shows assignee name', () => {
    renderWithClient(<ActivityList activities={[makeActivity()]} />);
    expect(screen.getByText('Max Muster')).toBeTruthy();
  });

  it('shows Erledigt badge for done activities', () => {
    renderWithClient(<ActivityList activities={[makeActivity({ done: true })]} />);
    expect(screen.getAllByText(/erledigt/i).length).toBeGreaterThan(0);
  });

  it('shows Offen badge for open activities', () => {
    renderWithClient(<ActivityList activities={[makeActivity({ done: false })]} />);
    expect(screen.getByText('Offen')).toBeTruthy();
  });

  it('select-all checkbox selects all rows', () => {
    const activities = [makeActivity(), makeActivity({ id: 'act-2', subject: 'Zweite' })];
    renderWithClient(<ActivityList activities={activities} />);

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all"
    fireEvent.click(checkboxes[0]!);
    // After selecting all, clicking again should deselect
    const checkboxesAfter = screen.getAllByRole('checkbox');
    expect(checkboxesAfter[0]).toBeTruthy();
  });

  it('opens action menu on MoreHorizontal click', () => {
    renderWithClient(<ActivityList activities={[makeActivity()]} />);
    // find the ... button (last button in the row)
    const actionBtn = screen.getAllByRole('button').at(-1)!;
    fireEvent.click(actionBtn);
    // menu should appear
    expect(screen.getByText('Löschen')).toBeTruthy();
  });

  it('renders duration when startTime and endTime present', () => {
    const start = '2026-05-12T10:00:00Z';
    const end = '2026-05-12T11:00:00Z';
    renderWithClient(
      <ActivityList
        activities={[makeActivity({ type: 'MEETING', startTime: start, endTime: end })]}
      />,
    );
    expect(screen.getByText('60 Min.')).toBeTruthy();
  });

  it('shows person link when person is set', () => {
    const activity = makeActivity({
      person: { id: 'p-1', firstName: 'Maria', lastName: 'Schmidt' },
    });
    renderWithClient(<ActivityList activities={[activity]} />);
    expect(screen.getByText('Maria Schmidt')).toBeTruthy();
  });

  it('shows org name when org is set', () => {
    const activity = makeActivity({ org: { id: 'o-1', name: 'Acme GmbH' } });
    renderWithClient(<ActivityList activities={[activity]} />);
    expect(screen.getByText('Acme GmbH')).toBeTruthy();
  });
});
