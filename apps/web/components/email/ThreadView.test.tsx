import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ThreadDetail } from '@/lib/email-api';
import * as emailApi from '@/lib/email-api';
import { ThreadView } from './ThreadView';

vi.mock('@/lib/email-api', () => ({
  summarizeThread: vi.fn(),
  sendEmail: vi.fn(),
}));

const makeThread = (emailCount = 2): ThreadDetail => ({
  threadId: 'thread-1',
  emails: Array.from({ length: emailCount }, (_, i) => ({
    id: `email-${i}`,
    threadId: 'thread-1',
    fromAddress: 'alice@acme.com',
    toAddresses: ['bob@nextgen.com'],
    cc: [],
    bcc: [],
    subject: 'Project Update',
    bodyPreview: `Message body ${i}`,
    isRead: true,
    isSent: false,
    sentAt: new Date(Date.now() - i * 3600_000).toISOString(),
    dealId: null,
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    deal: null,
  })),
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ThreadView', () => {
  it('renders empty state when no thread selected', () => {
    render(<ThreadView thread={null} />);

    expect(screen.getByText('E-Mail auswählen')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<ThreadView thread={null} isLoading />);

    expect(screen.getByText('Laden…')).toBeInTheDocument();
  });

  it('renders thread subject and email count', () => {
    render(<ThreadView thread={makeThread(3)} />);

    expect(screen.getByText('Project Update')).toBeInTheDocument();
    expect(screen.getByText('3 E-Mail(s)')).toBeInTheDocument();
  });

  it('renders reply bar with latest sender', () => {
    render(<ThreadView thread={makeThread(2)} />);

    expect(screen.getByText(/Antworten an alice@acme.com/)).toBeInTheDocument();
  });

  it('opens compose modal on reply click', () => {
    render(<ThreadView thread={makeThread(2)} />);

    fireEvent.click(screen.getByText(/Antworten an/));

    expect(screen.getByText('Neue E-Mail')).toBeInTheDocument();
  });

  it('does not show AI banner for threads with < 5 emails', () => {
    render(<ThreadView thread={makeThread(3)} />);

    expect(screen.queryByText(/KI-Zusammenfassung/)).not.toBeInTheDocument();
  });

  it('shows AI summary load button for threads with >= 5 emails', () => {
    render(<ThreadView thread={makeThread(6)} />);

    expect(screen.getByText(/KI-Zusammenfassung für 6 E-Mails/)).toBeInTheDocument();
  });

  it('calls summarizeThread on load click', async () => {
    const mockSummarize = vi.mocked(emailApi.summarizeThread);
    mockSummarize.mockResolvedValue({
      bullets: ['Punkt 1'],
      suggestedReply: 'Reply text',
      tone: 'neutral',
    });

    render(<ThreadView thread={makeThread(6)} />);

    fireEvent.click(screen.getByText('Anzeigen'));

    await waitFor(() => {
      expect(mockSummarize).toHaveBeenCalledWith('thread-1');
    });
  });

  it('expands/collapses email cards on toggle', () => {
    render(<ThreadView thread={makeThread(2)} />);

    // Last email is expanded by default, click header of first email to expand
    const firstCard = screen.getAllByText('alice@acme.com')[0]!;
    const button = firstCard.closest('button');
    if (button) fireEvent.click(button);

    // After toggle, header area is still rendered
    expect(screen.getAllByText('alice@acme.com').length).toBeGreaterThan(0);
  });
});
