import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AISummaryBanner } from './AISummaryBanner';
import type { AISummary } from '@/lib/email-api';

const makeSummary = (overrides = {}): AISummary => ({
  bullets: ['Punkt 1', 'Punkt 2', 'Punkt 3'],
  suggestedReply: 'Danke für Ihre Nachricht…',
  tone: 'neutral',
  ...overrides,
});

describe('AISummaryBanner', () => {
  it('renders nothing for threads with < 5 emails', () => {
    const { container } = render(
      <AISummaryBanner
        threadId="t1"
        emailCount={3}
        summary={null}
        isLoading={false}
        onLoad={vi.fn()}
        onDraftReply={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows load prompt for large threads without summary', () => {
    render(
      <AISummaryBanner
        threadId="t1"
        emailCount={6}
        summary={null}
        isLoading={false}
        onLoad={vi.fn()}
        onDraftReply={vi.fn()}
      />,
    );

    expect(screen.getByText(/KI-Zusammenfassung für 6 E-Mails/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anzeigen' })).toBeInTheDocument();
  });

  it('calls onLoad when Anzeigen is clicked', () => {
    const onLoad = vi.fn();
    render(
      <AISummaryBanner
        threadId="t1"
        emailCount={8}
        summary={null}
        isLoading={false}
        onLoad={onLoad}
        onDraftReply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Anzeigen' }));

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it('shows loading spinner while loading', () => {
    render(
      <AISummaryBanner
        threadId="t1"
        emailCount={6}
        summary={null}
        isLoading
        onLoad={vi.fn()}
        onDraftReply={vi.fn()}
      />,
    );

    expect(screen.getByText('KI analysiert Thread…')).toBeInTheDocument();
  });

  it('renders summary bullets after expand', () => {
    const summary = makeSummary();
    render(
      <AISummaryBanner
        threadId="t1"
        emailCount={6}
        summary={summary}
        isLoading={false}
        onLoad={vi.fn()}
        onDraftReply={vi.fn()}
      />,
    );

    // Initially collapsed — click to expand
    fireEvent.click(screen.getByRole('button', { name: 'KI-Zusammenfassung ein/ausklappen' }));

    expect(screen.getByText('Punkt 1')).toBeInTheDocument();
    expect(screen.getByText('Punkt 2')).toBeInTheDocument();
    expect(screen.getByText('Punkt 3')).toBeInTheDocument();
  });

  it('calls onDraftReply when Als Entwurf laden is clicked', () => {
    const onDraftReply = vi.fn();
    const summary = makeSummary();
    render(
      <AISummaryBanner
        threadId="t1"
        emailCount={6}
        summary={summary}
        isLoading={false}
        onLoad={vi.fn()}
        onDraftReply={onDraftReply}
      />,
    );

    // Expand first
    fireEvent.click(screen.getByRole('button', { name: 'KI-Zusammenfassung ein/ausklappen' }));
    fireEvent.click(screen.getByText('Als Entwurf laden'));

    expect(onDraftReply).toHaveBeenCalledWith(summary.suggestedReply);
  });

  it('shows tone badge correctly', () => {
    const summary = makeSummary({ tone: 'urgent' });
    render(
      <AISummaryBanner
        threadId="t1"
        emailCount={6}
        summary={summary}
        isLoading={false}
        onLoad={vi.fn()}
        onDraftReply={vi.fn()}
      />,
    );

    expect(screen.getByText('Dringend')).toBeInTheDocument();
  });

  it('renders nothing when summary is skipped', () => {
    const { container } = render(
      <AISummaryBanner
        threadId="t1"
        emailCount={6}
        summary={{ bullets: [], suggestedReply: null, tone: 'neutral', skipped: true }}
        isLoading={false}
        onLoad={vi.fn()}
        onDraftReply={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
