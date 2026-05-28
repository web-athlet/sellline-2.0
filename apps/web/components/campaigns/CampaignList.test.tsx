import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampaignList } from './CampaignList';
import type { Campaign } from '@/lib/campaigns-api';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: 'camp-1',
  name: 'Summer Newsletter',
  subject: 'Hello Summer!',
  bodyHtml: '<p>Hi</p>',
  previewText: null,
  status: 'DRAFT',
  scheduledAt: null,
  sentAt: null,
  senderId: 'user-1',
  totalRecipients: 100,
  openCount: 25,
  clickCount: 10,
  unsubCount: 2,
  bounceCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sender: { id: 'user-1', name: 'Alice Smith', email: 'alice@example.com' },
  ...overrides,
});

describe('CampaignList', () => {
  it('renders loading skeletons', () => {
    const { container } = render(
      <CampaignList campaigns={[]} isLoading={true} onDelete={vi.fn()} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders empty state with CTA', () => {
    render(<CampaignList campaigns={[]} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText('Noch keine Kampagnen')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Neue Kampagne/i })).toBeTruthy();
  });

  it('renders campaign name and subject', () => {
    render(<CampaignList campaigns={[makeCampaign()]} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText('Summer Newsletter')).toBeTruthy();
    expect(screen.getByText('Hello Summer!')).toBeTruthy();
  });

  it('renders DRAFT status badge', () => {
    render(<CampaignList campaigns={[makeCampaign()]} isLoading={false} onDelete={vi.fn()} />);
    expect(screen.getByText('Entwurf')).toBeTruthy();
  });

  it('renders SENT status badge', () => {
    render(
      <CampaignList
        campaigns={[makeCampaign({ status: 'SENT' })]}
        isLoading={false}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Gesendet')).toBeTruthy();
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    render(<CampaignList campaigns={[makeCampaign()]} isLoading={false} onDelete={onDelete} />);
    const deleteBtn = screen.getByTitle('Löschen');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('camp-1');
  });

  it('hides delete button for non-DRAFT campaigns', () => {
    render(
      <CampaignList
        campaigns={[makeCampaign({ status: 'SENT' })]}
        isLoading={false}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByTitle('Löschen')).toBeNull();
  });

  it('toggles stats panel on more-options click', () => {
    render(<CampaignList campaigns={[makeCampaign()]} isLoading={false} onDelete={vi.fn()} />);
    const btn = screen.getByTitle('Stats anzeigen');
    // Initially stats are hidden
    expect(screen.queryByText('Empfänger')).toBeNull();
    fireEvent.click(btn);
    // After click, stats are visible
    expect(screen.getByText('Empfänger')).toBeTruthy();
    // Click again to collapse
    fireEvent.click(btn);
    expect(screen.queryByText('Empfänger')).toBeNull();
  });

  it('renders recipient count', () => {
    render(
      <CampaignList
        campaigns={[makeCampaign({ totalRecipients: 42 })]}
        isLoading={false}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('42 Empfänger')).toBeTruthy();
  });

  it('links campaign name to detail page', () => {
    render(<CampaignList campaigns={[makeCampaign()]} isLoading={false} onDelete={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'Summer Newsletter' });
    expect(link.getAttribute('href')).toBe('/campaigns/camp-1');
  });
});
