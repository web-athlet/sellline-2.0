import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InboxSidebar } from './InboxSidebar';
import type { EmailSummary } from '@/lib/email-api';

const makeEmail = (overrides = {}): EmailSummary => ({
  id: 'email-1',
  threadId: 'thread-1',
  fromAddress: 'alice@acme.com',
  toAddresses: ['bob@nextgen.com'],
  cc: [],
  bcc: [],
  subject: 'Project update',
  bodyPreview: 'Here is the latest status…',
  isRead: false,
  isSent: false,
  sentAt: new Date().toISOString(),
  dealId: null,
  userId: 'user-1',
  createdAt: new Date().toISOString(),
  deal: null,
  ...overrides,
});

describe('InboxSidebar', () => {
  it('renders loading state', () => {
    render(<InboxSidebar threads={[]} selectedThreadId={null} onSelect={vi.fn()} isLoading />);

    expect(screen.getByText('Laden…')).toBeInTheDocument();
  });

  it('renders empty state when no threads', () => {
    render(<InboxSidebar threads={[]} selectedThreadId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Keine E-Mails')).toBeInTheDocument();
  });

  it('renders thread rows', () => {
    const threads = [
      makeEmail(),
      makeEmail({ id: 'e2', threadId: 'thread-2', subject: 'Invoice' }),
    ];
    render(<InboxSidebar threads={threads} selectedThreadId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Project update')).toBeInTheDocument();
    expect(screen.getByText('Invoice')).toBeInTheDocument();
  });

  it('calls onSelect with threadId on click', () => {
    const onSelect = vi.fn();
    const threads = [makeEmail()];
    render(<InboxSidebar threads={threads} selectedThreadId={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Project update'));

    expect(onSelect).toHaveBeenCalledWith('thread-1');
  });

  it('calls onSearch with debounced input', () => {
    const onSearch = vi.fn();
    render(
      <InboxSidebar threads={[]} selectedThreadId={null} onSelect={vi.fn()} onSearch={onSearch} />,
    );

    fireEvent.change(screen.getByPlaceholderText('Suchen…'), { target: { value: 'invoice' } });

    expect(onSearch).toHaveBeenCalledWith('invoice');
  });

  it('highlights selected thread', () => {
    const threads = [makeEmail()];
    const { container } = render(
      <InboxSidebar threads={threads} selectedThreadId="thread-1" onSelect={vi.fn()} />,
    );

    expect(container.querySelector('.border-l-blue-600')).toBeInTheDocument();
  });

  it('shows deal badge when email has deal', () => {
    const threads = [makeEmail({ deal: { id: 'deal-1', title: 'ACME Deal' } })];
    render(<InboxSidebar threads={threads} selectedThreadId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('ACME Deal')).toBeInTheDocument();
  });

  it('shows sent indicator for sent emails', () => {
    const threads = [makeEmail({ isSent: true, toAddresses: ['customer@acme.com'] })];
    render(<InboxSidebar threads={threads} selectedThreadId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('An: customer@acme.com')).toBeInTheDocument();
  });

  it('groups threads by date (Heute/Gestern/Älter)', () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    const older = new Date(Date.now() - 3 * 86_400_000);

    const threads = [
      makeEmail({ id: 'e1', threadId: 't1', sentAt: today.toISOString() }),
      makeEmail({ id: 'e2', threadId: 't2', sentAt: yesterday.toISOString() }),
      makeEmail({ id: 'e3', threadId: 't3', sentAt: older.toISOString() }),
    ];
    render(<InboxSidebar threads={threads} selectedThreadId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Heute')).toBeInTheDocument();
    expect(screen.getByText('Gestern')).toBeInTheDocument();
    expect(screen.getByText('Älter')).toBeInTheDocument();
  });
});
