import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStats } from './CampaignStats';
import type { Campaign } from '@/lib/campaigns-api';

const makeCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: 'c1',
  name: 'N',
  subject: 'S',
  bodyHtml: '',
  previewText: null,
  status: 'SENT',
  scheduledAt: null,
  sentAt: null,
  senderId: 'u1',
  totalRecipients: 100,
  openCount: 40,
  clickCount: 10,
  unsubCount: 3,
  bounceCount: 2,
  createdAt: '',
  updatedAt: '',
  sender: { id: 'u1', name: 'A B', email: 'a@b.com' },
  ...overrides,
});

describe('CampaignStats', () => {
  it('renders all stat labels', () => {
    render(<CampaignStats campaign={makeCampaign()} />);
    expect(screen.getByText('Empfänger')).toBeTruthy();
    expect(screen.getByText('Geöffnet')).toBeTruthy();
    expect(screen.getByText('Geklickt')).toBeTruthy();
    expect(screen.getByText('Abgemeldet')).toBeTruthy();
    expect(screen.getByText('Bounced')).toBeTruthy();
  });

  it('shows correct open rate percentage', () => {
    render(<CampaignStats campaign={makeCampaign()} />);
    expect(screen.getByText('40.0%')).toBeTruthy();
  });

  it('shows 0.0% when totalRecipients is 0', () => {
    render(<CampaignStats campaign={makeCampaign({ totalRecipients: 0 })} />);
    const zeros = screen.getAllByText('0.0%');
    expect(zeros.length).toBe(2); // open + click rate
  });

  it('renders stat values', () => {
    render(<CampaignStats campaign={makeCampaign()} />);
    expect(screen.getByText('100')).toBeTruthy(); // totalRecipients
    expect(screen.getByText('40')).toBeTruthy(); // openCount
  });
});
