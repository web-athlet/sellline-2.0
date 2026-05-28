import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiInsightCard } from './AiInsightCard';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'tok-123' }, status: 'authenticated' }),
}));

vi.mock('@/lib/insights-api', () => ({
  insightsKeys: {
    lossInsight: () => ['insights', 'loss-analysis'],
  },
  getLossInsight: vi.fn(),
  triggerLossAnalysis: vi.fn(),
}));

import * as api from '@/lib/insights-api';

const getLossInsight = vi.mocked(api.getLossInsight);
const triggerLossAnalysis = vi.mocked(api.triggerLossAnalysis);

const makeInsight = () => ({
  id: 'ins-1',
  type: 'loss_analysis',
  content: {
    reasons: [
      {
        pattern: 'Zu teuer',
        count: 8,
        recommendation: 'Preismodell überdenken',
        priority: 'high' as const,
      },
      {
        pattern: 'Falscher Zeitpunkt',
        count: 5,
        recommendation: 'Follow-up planen',
        priority: 'medium' as const,
      },
      {
        pattern: 'Konkurrenz',
        count: 3,
        recommendation: 'USPs hervorheben',
        priority: 'low' as const,
      },
    ],
  },
  validUntil: '2026-06-05T09:00:00.000Z',
  createdAt: '2026-05-29T09:00:00.000Z',
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('AiInsightCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    getLossInsight.mockReturnValue(new Promise(() => {}));
    const { container } = wrap(<AiInsightCard />);
    expect(container.textContent).toContain('Lade');
  });

  it('renders 3 reason cards when insight is available', async () => {
    getLossInsight.mockResolvedValue(makeInsight());
    wrap(<AiInsightCard />);
    await waitFor(() => expect(screen.getByText('Zu teuer')).toBeTruthy());
    expect(screen.getByText('Falscher Zeitpunkt')).toBeTruthy();
    expect(screen.getByText('Konkurrenz')).toBeTruthy();
  });

  it('shows recommendation text', async () => {
    getLossInsight.mockResolvedValue(makeInsight());
    wrap(<AiInsightCard />);
    await waitFor(() => expect(screen.getByText('Preismodell überdenken')).toBeTruthy());
  });

  it('shows empty state when no insight', async () => {
    getLossInsight.mockResolvedValue(null);
    wrap(<AiInsightCard />);
    await waitFor(() => expect(screen.getByText(/noch keine analyse/i)).toBeTruthy());
  });

  it('shows error message from content.error', async () => {
    getLossInsight.mockResolvedValue({
      id: 'ins-err',
      type: 'loss_analysis',
      content: { reasons: [], error: 'OpenAI not configured' },
      validUntil: null,
      createdAt: new Date().toISOString(),
    });
    wrap(<AiInsightCard />);
    await waitFor(() => expect(screen.getByText(/openai not configured/i)).toBeTruthy());
  });

  it('calls triggerLossAnalysis on Neu analysieren click', async () => {
    getLossInsight.mockResolvedValue(makeInsight());
    triggerLossAnalysis.mockResolvedValue(makeInsight());
    wrap(<AiInsightCard />);
    await waitFor(() => screen.getByText('Zu teuer'));
    fireEvent.click(screen.getByLabelText('Neu analysieren'));
    expect(triggerLossAnalysis).toHaveBeenCalledWith('tok-123');
  });

  it('shows createdAt date in footer', async () => {
    getLossInsight.mockResolvedValue(makeInsight());
    wrap(<AiInsightCard />);
    await waitFor(() => expect(screen.getByText(/analysiert/i)).toBeTruthy());
  });
});
